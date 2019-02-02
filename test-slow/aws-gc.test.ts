import { AWSServices, GcWork } from "../src/aws/aws-faast";
import { faastify } from "../src/faast";
import { sleep } from "../src/shared";
import * as functions from "../test/functions";
import { quietly, record, contains } from "../test/tests";
import { logGc } from "../src/log";
import test from "ava";

test("aws garbage collector works for functions that are called", async t => {
    // Idea behind this test: create a faast function and make a call.
    // Then cleanup while leaving the resources in place. Then create another
    // function and set its retention to 0, and use a recorder to observe
    // its garbage collector to verify that it would clean up the first function,
    // which shows that the garbage collector did its job.

    const gcRecorder = record(async (_: AWSServices, work: GcWork) => {
        logGc(`Recorded gc work: %O`, work);
    });
    const func = await faastify("aws", functions, "../test/functions");
    const { cloudwatch } = func.state.services;
    await new Promise(async resolve => {
        let done = false;
        func.functions.hello("gc-test");
        while (!done) {
            await sleep(1000);
            const logResult = await quietly(
                cloudwatch
                    .filterLogEvents({
                        logGroupName: func.state.resources.logGroupName
                    })
                    .promise()
            );
            const events = (logResult && logResult.events) || [];
            for (const event of events) {
                if (event.message!.match(/REPORT RequestId/)) {
                    resolve();
                    done = true;
                    break;
                }
            }
        }
    });

    await func.cleanup({ deleteResources: false });
    const func2 = await faastify("aws", functions, "../test/functions", {
        gcWorker: gcRecorder,
        retentionInDays: 0
    });

    // Simulate expiration of all log streams
    const { logGroupName } = func.state.resources;
    const logStreamsResponse = await quietly(
        cloudwatch.describeLogStreams({ logGroupName }).promise()
    );
    const logStreams = (logStreamsResponse && logStreamsResponse.logStreams) || [];
    for (const { logStreamName } of logStreams) {
        if (logStreamName) {
            await cloudwatch.deleteLogStream({ logGroupName, logStreamName }).promise();
        }
    }
    await func2.cleanup();
    // The role name, SNS subscription, and Request Queue ARN are resources that are not garbage collected. The role name is cached between calls. The SNS subscription is deleted by AWS asynchronously (possibly days later) when the SNS topic it's subscribed to is deleted. The Request Queue ARN is redundant information with the Request Queue URL, which is the resource identifier used for deletion of the queue.
    const {
        RoleName,
        SNSLambdaSubscriptionArn,
        ResponseQueueArn,
        ...resources
    } = func.state.resources;
    t.truthy(
        gcRecorder.recordings.find(
            r =>
                r.args[1].type === "DeleteResources" &&
                contains(r.args[1].resources, resources)
        )
    );
    await func.cleanup();
});

test("aws garbage collector works for functions that are never called", async t => {
    const gcRecorder = record(async (_: AWSServices, _work: GcWork) => {});

    const func = await faastify("aws", functions, "../test/functions");
    await func.cleanup({ deleteResources: false });
    const func2 = await faastify("aws", functions, "../test/functions", {
        gcWorker: gcRecorder,
        retentionInDays: 0
    });

    await func2.cleanup();

    const {
        RoleName,
        SNSLambdaSubscriptionArn,
        ResponseQueueArn,
        ...resources
    } = func.state.resources;

    t.truthy(
        gcRecorder.recordings.find(
            r =>
                r.args[1].type === "DeleteResources" &&
                contains(r.args[1].resources, resources)
        )
    );
    await func.cleanup();
});
