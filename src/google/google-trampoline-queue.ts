import { google, pubsub_v1 } from "googleapis";
import { env } from "process";
import { createErrorResponse, FunctionCall, Wrapper } from "../wrapper";
import { publish, publishControlMessage } from "./google-queue";
import { getExecutionLogUrl } from "./google-shared";
import PubSubApi = pubsub_v1;

export const filename = module.filename;

interface CloudFunctionContext {
    eventId: string;
    timestamp: string;
    eventType: string;
    resource: object;
}

let pubsub: PubSubApi.Pubsub;
type PubsubMessage = PubSubApi.Schema$PubsubMessage;

async function initialize() {
    if (!pubsub) {
        const auth = await google.auth.getClient({
            scopes: ["https://www.googleapis.com/auth/cloud-platform"]
        });
        google.options({ auth });
        pubsub = google.pubsub("v1");
    }
}

export function makeTrampoline(wrapper: Wrapper) {
    async function trampoline(data: PubsubMessage, context: CloudFunctionContext) {
        const startTime = Date.now();
        await initialize();

        const executionId = context.eventId;
        const project = env["GCP_PROJECT"]!;
        const functionName = env["FUNCTION_NAME"]!;
        const logUrl = getExecutionLogUrl(project, functionName, executionId);
        const str = Buffer.from(data.data!, "base64");
        const call: FunctionCall = JSON.parse(str.toString());
        const { CallId, ResponseQueueId } = call;
        const startedMessageTimer = setTimeout(
            () =>
                publishControlMessage("functionstarted", pubsub, ResponseQueueId!, {
                    CallId
                }),
            2 * 1000
        );

        const callingContext = {
            call,
            startTime,
            logUrl,
            executionId
        };

        try {
            const returned = await wrapper.execute(callingContext);
            clearTimeout(startedMessageTimer);
            await publish(pubsub, call.ResponseQueueId!, JSON.stringify(returned), {
                CallId
            });
        } catch (err) {
            console.error(err);
            if (ResponseQueueId) {
                const response = createErrorResponse(err, callingContext);
                await publish(pubsub, ResponseQueueId!, JSON.stringify(response), {
                    CallId
                });
            }
        }
    }
    return { trampoline };
}
