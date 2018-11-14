import { deepStrictEqual } from "assert";
import * as childProcess from "child_process";
import * as process from "process";
import { inspect } from "util";
import { Deferred } from "./funnel";
import { AnyFunction } from "./type-helpers";

export const filename = module.filename;

export interface CallId {
    CallId: string;
}

export interface Trampoline {
    trampoline: AnyFunction;
}

export interface TrampolineFactory {
    filename: string;
    makeTrampoline: (moduleWrapper: ModuleWrapper) => Trampoline;
}

export interface FunctionCall extends CallId {
    name: string;
    modulePath: string;
    args: any[];
    ResponseQueueId?: string;
}

export interface FunctionReturn extends CallId {
    type: "returned" | "error";
    value?: any;
    remoteExecutionStartTime?: number;
    remoteExecutionEndTime?: number;
    logUrl?: string;
    instanceId?: string;
    executionId?: string;
    memoryUsage?: NodeJS.MemoryUsage;
}

export interface CallingContext {
    call: FunctionCall;
    startTime: number;
    logUrl?: string;
    executionId?: string;
    instanceId?: string;
}

export interface FunctionReturnWithMetrics {
    returned: FunctionReturn;
    rawResponse: any;
    localRequestSentTime: number;
    remoteResponseSentTime?: number;
    localEndTime: number;
}

export interface ModuleType {
    [name: string]: AnyFunction;
}

export function createErrorResponse(
    err: Error,
    { call, startTime, logUrl, executionId }: CallingContext
): FunctionReturn {
    const errObj = {};
    Object.getOwnPropertyNames(err).forEach(name => {
        if (typeof err[name] === "string") {
            errObj[name] = err[name];
        }
    });
    return {
        type: "error",
        value: errObj,
        CallId: call.CallId || "",
        remoteExecutionStartTime: startTime,
        remoteExecutionEndTime: Date.now(),
        logUrl,
        executionId
    };
}

export interface ModuleWrapperOptions {
    /**
     * Output additional information with each execution to aid debugging. On
     * most cloud providers these go into the cloud logs. With the "immediate"
     * provider, the logs go to stdout. Defaults to true.
     *
     * @type {boolean}
     */
    verbose?: boolean;

    /**
     * Logging function for console.log/warn/error output. Only available in child process mode.
     */
    log?: (msg: string) => void;

    useChildProcess?: boolean;
}

export class ModuleWrapper {
    funcs: ModuleType = {};
    child?: childProcess.ChildProcess;
    deferred?: Deferred<FunctionReturn>;
    options: Required<ModuleWrapperOptions>;

    constructor(fModule: ModuleType, options: ModuleWrapperOptions = {}) {
        this.options = {
            verbose: true,
            useChildProcess: false,
            log: () => { },
            ...options
        };

        this.funcs = fModule;
        const { verbose } = this.options;

        if (process.env["CLOUDIFY_CHILD"]) {
            verbose && console.log(`cloudify: started child process for module wrapper.`);
            process.on("message", async (call: FunctionCall) => {
                const startTime = Date.now();
                try {
                    const ret = await this.execute({ call, startTime });
                    process.send!(ret);
                } catch (err) {
                    console.error(err);
                }
            });
        } else if (verbose) {
            console.log(`cloudify: successful cold start.`);
        }
    }

    lookupFunction(request: object): AnyFunction {
        const { name, args } = request as FunctionCall;
        if (!name) {
            throw new Error("Invalid function call request: no name");
        }

        const func = this.funcs[name];
        if (!func) {
            throw new Error(`Function named "${name}" not found`);
        }

        if (!args) {
            throw new Error("Invalid arguments to function call");
        }
        return func;
    }

    async stop() {
        if (this.child) {
            this.child.disconnect();
        }
    }

    async execute(callingContext: CallingContext): Promise<FunctionReturn> {
        const { verbose } = this.options;
        try {
            const memoryUsage = process.memoryUsage();
            const { call, startTime, logUrl, executionId, instanceId } = callingContext;
            if (this.options.useChildProcess) {
                this.deferred = new Deferred();
                if (!this.child) {
                    verbose && console.log(`cloudify: creating child process`);
                    this.child = childProcess.fork("./index.js", [], {
                        silent: true, // This just redirects stdout and stderr to IPC.
                        env: { CLOUDIFY_CHILD: "true" }
                    });

                    this.child!.stdout.setEncoding("utf8");
                    this.child!.stderr.setEncoding("utf8");

                    const logLines = (msg: string) => {
                        let lines = msg.split("\n");
                        if (lines[lines.length - 1] === "") {
                            lines = lines.slice(0, lines.length - 1);
                        }
                        for (const line of lines) {
                            this.options.log(line);
                        }
                    }
                    this.child!.stdout.on("data", logLines);
                    this.child!.stderr.on("data", logLines);

                    this.child.on("message", (value: FunctionReturn) =>
                        this.deferred!.resolve(value)
                    );
                    this.child.on("error", err => {
                        this.child = undefined;
                        this.deferred!.reject(err);
                    });
                    this.child.on("exit", (code, signal) => {
                        this.child = undefined;
                        if (code) {
                            this.deferred!.reject(
                                new Error(`Exited with error code ${code}`)
                            );
                        } else if (signal) {
                            this.deferred!.reject(
                                new Error(`Aborted with signal ${signal}`)
                            );
                        }
                    });
                }
                verbose && console.log(`cloudify: sending invoke message to child process for '${call.name}'`);
                this.child.send(
                    { ...call, useChildProcess: false },
                    err => err && this.deferred!.reject(err)
                );
                this.deferred!.promise.then(_ => (this.deferred = undefined));
                return this.deferred.promise;
            } else {
                const memInfo = inspect(memoryUsage, { compact: true, breakLength: Infinity });
                verbose &&
                    console.log(`cloudify: Invoking '${call.name}', memory: ${memInfo}`);
                const func = this.lookupFunction(call);
                const returned = await func.apply(undefined, call.args);
                const rv: FunctionReturn = {
                    type: "returned",
                    value: returned,
                    CallId: call.CallId,
                    remoteExecutionStartTime: startTime,
                    remoteExecutionEndTime: Date.now(),
                    logUrl,
                    executionId,
                    memoryUsage,
                    instanceId
                };
                return rv;
            }
        } catch (err) {
            if (verbose) {
                console.error(err);
            }
            return createErrorResponse(err, callingContext);
        }
    }
}

export function deepCopyUndefined(dest: object, source: object) {
    const stack: object[] = [];
    function isBackReference(o: object) {
        for (const elem of stack) {
            if (elem === o) {
                return true;
            }
        }
        return false;
    }
    function recurse(d: object, s: object) {
        if (isBackReference(s) || d === undefined) {
            return;
        }
        stack.push(s);
        Object.keys(s).forEach(key => {
            if (s[key] && typeof s[key] === "object") {
                recurse(d[key], s[key]);
            } else if (s[key] === undefined) {
                d[key] = undefined;
            }
        });
        stack.pop();
    }
    typeof source === "object" && recurse(dest, source);
}

export function serializeCall(call: FunctionCall) {
    const callStr = JSON.stringify(call);
    const deserialized = JSON.parse(callStr);
    deepCopyUndefined(deserialized, call);
    try {
        deepStrictEqual(deserialized, call);
    } catch (_) {
        throw new Error(
            `WARNING: problem serializing arguments to JSON
deserialized arguments: ${inspect(deserialized)}
original arguments: ${inspect(call)}
Detected function '${
            call.name
            }' argument loses information when serialized by JSON.stringify()`
        );
    }
    return callStr;
}
