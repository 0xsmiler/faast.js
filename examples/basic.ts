import { faast } from "faastjs";
import * as funcs from "./functions";

(async () => {
    // Create lambda infrastructure on the fly.
    const m = await faast("aws", funcs, "./functions");
    // Invoke the cloud function and await the result.
    await m.functions.hello("world");
    // Leave no infrastructure behind.
    await m.cleanup();
})();
