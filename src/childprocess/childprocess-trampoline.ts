import * as process from "process";
import { ModuleWrapper, FunctionReturn, createErrorResponse } from "../module-wrapper";
import { ProcessFunctionCall } from "./childprocess-cloudify";


process.on("message", async ({ call, serverModule, timeout }: ProcessFunctionCall) => {
    const startTime = Date.now();

    const timer = setTimeout(() => {
        const timeoutReturn: FunctionReturn = createErrorResponse(
            new Error(`Function timed out after ${timeout}s`),
            {
                call,
                startTime
            }
        );
        process.send!(timeoutReturn);
        process.disconnect();
        process.exit();
    }, timeout * 1000);

    try {
        const mod = require(serverModule);
        if (!mod) {
            throw new Error(`Could not find module '${serverModule}'`);
        }
        const moduleWrapper = new ModuleWrapper(mod)
        const ret = await moduleWrapper.execute({ call, startTime });
        process.send!(ret);
    } catch (err) {
        console.error(err);
    } finally {
        clearTimeout(timer);
        process.disconnect();
    }
});
