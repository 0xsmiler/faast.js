import * as webpack from "webpack";
import { CostBreakdown } from "./cost";
import { Statistics } from "./shared";
import { CpuMeasurement, FunctionReturn } from "./wrapper";

export const CALLID_ATTR = "__faast_callid__";
export const KIND_ATTR = "__faast_kind__";

/**
 * Options common across all faast.js providers.
 * @public
 */
export interface CommonOptions {
    /**
     * Add local directories to the code package.
     * @remarks
     * Each directory is recursively traversed. On the remote side, the
     * directories will be available on the file system relative to the current
     * working directory.
     */
    addDirectory?: string | string[];
    /**
     * Add zip files to the code package.
     * @remarks
     * Each file is unzipped on the remote side under the current working
     * directory.
     */
    addZipFile?: string | string[];
    /**
     * If true, create a child process to isolate user code from faast
     * scaffolding. Default: true.
     * @remarks
     * If a child process is not created, faast runs in the same node instance
     * as the user code and may not execute in a timely fashion because user
     * code may
     * {@link https://nodejs.org/en/docs/guides/dont-block-the-event-loop/ | block the event loop}.
     * Creating a child process for user code allows faast.js to continue
     * executing even if user code never yields. This provides better
     * reliability and functionality:
     *
     * - Detect timeout errors immediately instead of waiting for the provider's
     *   dead letter queue messages, which may take several minutes. See
     *   {@link CommonOptions.timeout}.
     *
     * - CPU metrics used for detecting invocations with high latency, which can
     *   be used for automatically retrying calls to reduce tail latency.
     *
     * The cost of creating a child process is mainly in the memory overhead of
     * creating another node process, which may consume a baseline of XXX.
     */
    childProcess?: boolean;
    /**
     * The maximum number of concurrent invocations to allow. Default: 100,
     * except for the `local` provider, where the default is 10.
     * @remarks
     * The concurrency limit applies to all invocations of all of the faast
     * functions summed together. It is not a per-function limit. To apply a
     * per-function limit, use {@link throttle}. A value of 0 is equivalent to
     * Infinity. A value of 1 ensures mutually exclusive invocations.
     */
    concurrency?: number;
    /**
     * Garbage collection is enabled if true. Default: true.
     * @remarks
     * Garbage collection deletes resources that were created by previous
     * instantiations of faast that were not cleaned up by
     * {@link CloudFunction.cleanup}, either because it was not called or
     * because the process terminated and did not execute this cleanup step.
     *
     * Garbage collection is cloud-specific, but in general garbage collection
     * should not interfere with the behavior or performance of faast functions.
     * When {@link CloudFunction.cleanup} runs, it waits for garbage collection
     * to complete. Therefore the cleanup step can in some circumstances take a
     * significant amount of time even after all invocations have returned.
     *
     * It is generally recommended to leave garbage collection on, otherwise
     * garbage resources may accumulate over time and you will eventually hit
     * resource limits on your account.
     *
     * One use case for turning off garbage collection is when many invocations
     * of faast are occurring in separate processes. In this case it can make
     * sense to leave gc on in only one process. Note that if faast is invoked
     * multiple times within one process, faast will automatically only run gc
     * once every hour.
     *
     * Also see {@link CommonOptions.retentionInDays}.
     */
    gc?: boolean;
    /**
     * Maximum number of times that faast will retry each invocation. Default: 2
     * (invocations can therefore be attemped 3 times in total).
     * @remarks
     * Retries are automatically attempted for transient infrastructure-level
     * failures such as rate limits or netowrk failures. User-level exceptions
     * are not retried automatically. In addition to retries performed by faast,
     * some providers automatically attempt retries. These are not controllable
     * by faast. But as a result, your function may be retried many more times
     * than this setting suggests.
     */
    maxRetries?: number;
    /**
     * Memory limit for each function in MB. This setting has an effect on
     * pricing. Default varies by provider.
     * @remarks
     * Each provider has different settings for memory size, and performance
     * varies depending on the setting. By default faast picks a likely optimal
     * value for each provider.
     *
     * - aws: 1728MB
     *
     * - google: 1024MB
     *
     * - local: 512MB
     */
    memorySize?: number;
    /**
     * Specify invocation mode. Default: `"auto"`.
     * @remarks
     * Modes specify how invocations are triggered. In https mode, the functions
     * are invoked through an https request or the provider's API. In queue
     * mode, a provider-specific queue is used to invoke functions. Queue mode
     * adds additional latency and (usually negligible) cost, but may scale
     * better for some providers. In auto mode the best default is chosen for
     * each provider depending on its particular performance characteristics.
     *
     * The defaults are:
     *
     * - aws: `"auto"` is the same as `"queue"`. In https mode, the AWS SDK
     *   api is used to invoke functions. In queue mode, an AWS SNS topic is
     *   created and triggers invocations. The AWS API Gateway service is never
     *   used by faast, as it incurs a higher cost and is not needed to trigger
     *   invocations.
     *
     * - google: `"auto"` is `"https"`. In https mode, a PUT request is made
     *   to invoke the cloud function. In queue mode, a PubSub topic is created
     *   to invoke functions.
     *
     * - local: The local provider ignores the mode setting and always uses
     *   an internal asynchronous queue to schedule calls.
     *
     * Note that no matter which mode is selected, faast.js always uses queue to
     * send results back. This queue is required because there are intermediate
     * data that faast.js needs for bookeeping and performance monitoring.
     */
    mode?: "https" | "queue" | "auto";
    /**
     * Specify a package.json file to include with the code package.
     * @remarks
     * By default, faast.js will use webpack to bundle dependencies your remote
     * module imports. In normal usage there is no need to specify a separate
     * package.json, as webpack will statically analyze your imports and
     * determine which files to bundle.
     *
     * However, there are some use cases where this is not enough. For example,
     * some dependencies contain native code compiled during installation, and
     * webpack cannot bundle these native modules. such as dependencies with
     * native code.  or are specifically not designed to work with webpack. In
     * these cases, you can create a separate `package.json` for these
     * dependencies and pass the filename as the `packageJson` option. If
     * `packageJson` is an `object`, it is assumed to be a parsed JSON object
     * with the same structure as a package.json file (useful for specifying a
     * synthetic `package.json` directly in code).
     *
     * The way the `packageJson` is handled varies by provider:
     *
     * - local: Runs `npm install` in a temporary directory it prepares for
     *   the function.
     *
     * - google: uses Google Cloud Function's
     *   {@link https://cloud.google.com/functions/docs/writing/specifying-dependencies-nodejs | native support for package.json}.
     *
     * - aws: Recursively calls faast.js to run `npm install` inside a
     *   separate lambda function specifically created for this purpose.
     *   Faast.js uses lambda to install dependencies to ensure that native
     *   dependencies are compiled in an environment that can produce binaries
     *   linked against lambda's
     *   {@link https://aws.amazon.com/blogs/compute/running-executables-in-aws-lambda/ | execution environment}.
     *
     * Also see {@link CommonOptions.useDependencyCaching}.
     */
    packageJson?: string | object;
    /**
     * Cache installed dependencies from {@link CommonOptions.packageJson}. Only
     * applies to AWS. Default: true.
     * @remarks
     * The resulting `node_modules` folder is cached both locally and also on S3
     * under the bucket `faast-cache-*-${region}`. These cache entries expire by
     * default after 24h. Using caching reduces the need to install and upload
     * dependencies every time a function is created. This is important for AWS
     * because it creates an entirely separate lambda function to install
     * dependencies remotely, which can substantially increase function
     * deployment time.
     */
    useDependencyCaching?: boolean;
    /**
     * Specify how many days to wait before reclaiming cloud garbage. Default:
     * 1.
     * @remarks
     * Garbage collection only deletes resources after they age beyond a certain
     * number of days. This option specifies how many days old a resource needs
     * to be before being considered garbage by the collector. Note that this
     * setting is not recorded when the resources are created. For example,
     * suppose this is the sequence of events:
     *
     * - Day 0: `faast()` is called with `retentionInDays` set to 5. Then, the
     *   function crashes (or omits the call to {@link CloudFunction.cleanup}).
     *
     * - Day 1: `faast()` is called with `retentionInDays` set to 1.
     *
     * In this sequence of events, on Day 0 the garbage collector runs and
     * removes resources with age older than 5 days. Then the function leaves
     * new garbage behind because it crashed or did not complete cleanup. On Day
     * 1, the garbage collector runs and deletes resources at least 1 day old,
     * which includes garbage left behind from Day 0 (based on the creation
     * timestamp of the resources). This deletion occurs even though retention
     * was set to 5 days when resources were created on Day 0.
     *
     * On Google, logs are retained according to Google's default expiration
     * policy instead of being deleted by garbage collection.
     *
     * Note that if `retentionInDays` is set to 0, garbage collection will
     * remove all resources, even ones that may be in use by other running faast
     * instances.
     *
     * See {@link CommonOptions.gc}.
     */
    retentionInDays?: number;
    /**
     * Reduce tail latency by retrying invocations that take substantially
     * longer than other invocations of the same function. Default: 3.
     * @remarks
     * faast.js automatically measures the mean and standard deviation (σ) of
     * the time taken by invocations of each function. Retries are attempted
     * when the time for an invocation exceeds the mean time by a certain
     * threshold. `speculativeRetryThreshold` specifies how many multiples of σ
     * an invocation needs to exceed the mean for a given function before retry
     * is attempted.
     *
     * The default value of σ is 3. This means a call to a function is retried
     * when the time to execute exceeds three standard deviations from the mean
     * of all prior executions of the same function.
     *
     * This feature is experimental.
     * @alpha
     */
    speculativeRetryThreshold?: number;
    /**
     * Execution time limit for each invocation, in seconds. Default: 60.
     * @remarks
     * Each provider has a maximum time limit for how long invocations can run
     * before being automatically terminated (or frozen). The following are the
     * maximum time limits as of February 2019:
     *
     * - aws:
     *   {@link https://docs.aws.amazon.com/lambda/latest/dg/limits.html | 15 minutes}
     *
     * - google:
     *   {@link https://cloud.google.com/functions/quotas | 9 minutes}
     *
     * - local: unlimited
     *
     * Faast.js has a proactive timeout detection feature. It automatically
     * attempts to detect when the time limit is about to be reached and
     * proactively sends a timeout exception. Faast does this because not all
     * providers reliably send timely feedback when timeouts occur, leaving
     * developers to look through cloud logs. In general faast.js' timeout will
     * be up to 200ms earlier than the timeout specified, in order to give time
     * to allow faast.js to send a timeout message. Proactive timeout detection
     * only works with {@link CommonOptions.childProcess} set to `true` (the
     * default).
     */
    timeout?: number;
    /**
     * Extra webpack options to use to bundle the code package.
     * @remarks
     * By default, faast.js uses webpack to bundle the code package. Webpack
     * automatically handles finding and bundling dependencies, adding source
     * mappings, etc. If you need specialized bundling, use this option to add
     * or override the default webpack configuration:
     *
     * ```typescript
     * const config: webpack.Configuration = {
     *   entry,
     *   mode: "development",
     *   output: {
     *       path: "/",
     *       filename: outputFilename,
     *       libraryTarget: "commonjs2"
     *   },
     *   target: "node",
     *   resolveLoader: { modules: [__dirname, `${__dirname}/build}`] },
     *   ...webpackOptions
     * };
     * ```
     *
     * Take care not to override the values of `entry`, `output`, or
     * `resolveLoader`. If these options are overwritten, faast.js may fail to
     * bundle your code.
     *
     * Default:
     *
     * - aws: `{ externals: "aws-sdk" }`. In the lambda
     *   environment `"aws-sdk"` is available in the ambient environment and
     *   does not need to be bundled.
     *
     * - other providers: `{}`
     */
    webpackOptions?: webpack.Configuration;
}

export const CommonOptionDefaults: Required<CommonOptions> = {
    addDirectory: [],
    addZipFile: [],
    childProcess: true,
    concurrency: 100,
    gc: true,
    maxRetries: 2,
    memorySize: 1024,
    mode: "auto",
    packageJson: "",
    useDependencyCaching: true,
    retentionInDays: 1,
    speculativeRetryThreshold: 3,
    timeout: 60,
    webpackOptions: {}
};

/**
 * Options that apply to the {@link CloudFunction.cleanup} method.
 * @public
 */
export interface CleanupOptions {
    /**
     * If true, delete provider cloud resources. Default: true.
     * @remarks
     * The cleanup operation has two functions: stopping the faast.js runtime
     * and deleting cloud resources that were instantiated. If `deleteResources`
     * is false, then only the runtime is stopped and no cloud resources are
     * deleted. This can be useful for debugging and examining the state of
     * resources created by faast.js.
     *
     * It is supported to call {@link CloudFunction.cleanup} twice: once with
     * `deleteResources` set to `false`, which only stops the runtime, and then
     * again set to `true` to delete resources. This can be useful for testing.
     */
    deleteResources?: boolean;
}

export const CleanupOptionDefaults: Required<CleanupOptions> = {
    deleteResources: true
};

/**
 * @public
 */
export class FunctionCounters {
    invocations = 0;
    completed = 0;
    retries = 0;
    errors = 0;

    toString() {
        return `completed: ${this.completed}, retries: ${this.retries}, errors: ${
            this.errors
        }`;
    }
}

/**
 * @public
 */
export class FunctionStats {
    localStartLatency = new Statistics();
    remoteStartLatency = new Statistics();
    executionTime = new Statistics();
    sendResponseLatency = new Statistics();
    returnLatency = new Statistics();
    estimatedBilledTime = new Statistics();

    toString() {
        return Object.keys(this)
            .map(key => `${key}: ${(<any>this)[key]}`)
            .join(", ");
    }
}

export class FunctionExecutionMetrics {
    secondMetrics: Statistics[] = [];
}

export type StringifiedFunctionCall = string;
export type StringifiedFunctionReturn = string;

export type CallId = string;

export interface Invocation {
    callId: CallId;
    body: StringifiedFunctionCall;
}

export interface ResponseMessage {
    kind: "response";
    callId: CallId;
    body: StringifiedFunctionReturn | FunctionReturn;
    rawResponse?: any;
    timestamp?: number; // timestamp when response message was sent according to cloud service, this is optional and used to provide more accurate metrics.
}

export interface DeadLetterMessage {
    kind: "deadletter";
    callId: CallId;
    message?: string;
}

export interface StopQueueMessage {
    kind: "stopqueue";
}

export interface FunctionStartedMessage {
    kind: "functionstarted";
    callId: CallId;
}

export interface CpuMetricsMessage {
    kind: "cpumetrics";
    callId: CallId;
    metrics: CpuMeasurement;
}

export interface PollResult {
    Messages: ReceivableMessage[];
    isFullMessageBatch?: boolean;
}

export type SendableMessage = StopQueueMessage;

export type ReceivableMessage =
    | DeadLetterMessage
    | ResponseMessage
    | FunctionStartedMessage
    | StopQueueMessage
    | CpuMetricsMessage;

export type Message = SendableMessage | ReceivableMessage;
export type SendableKind = SendableMessage["kind"];
export type ReceivableKind = ReceivableMessage["kind"];
export type Kind = Message["kind"];
export type UUID = string;

export interface CloudFunctionImpl<O extends CommonOptions, S> {
    name: string;
    defaults: Required<O>;

    initialize(serverModule: string, nonce: UUID, options: Required<O>): Promise<S>;

    costEstimate?: (
        state: S,
        counters: FunctionCounters,
        stats: FunctionStats
    ) => Promise<CostBreakdown>;

    cleanup(state: S, options: Required<CleanupOptions>): Promise<void>;
    logUrl(state: S): string;
    invoke(
        state: S,
        request: Invocation,
        cancel: Promise<void>
    ): Promise<ResponseMessage | void>;
    publish(state: S, message: SendableMessage): Promise<void>;
    poll(state: S, cancel: Promise<void>): Promise<PollResult>;
    responseQueueId(state: S): string | void;
}
