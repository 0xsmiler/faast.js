import { checkFunctions } from "./tests";
import * as cloudify from "../src/cloudify";
import * as funcs from "./functions";

describe.skip("child-process", () => {
    describe("basic functions", () => checkFunctions("childprocess", {}));

    test("cloudify childprocess cleanup waits for all child processes to exit", async () => {
        const cloud = cloudify.create("childprocess");
        const func = await cloud.createFunction("./functions");
        const process = func.cloudifyModule(funcs);
        process.hello("there").catch(_ => {});
        process.delay(2000).catch(_ => {});
        expect(func.state.resources.childProcesses.size).toBe(2);
        await func.cleanup();
        expect(func.state.resources.childProcesses.size).toBe(0);
    });
});
