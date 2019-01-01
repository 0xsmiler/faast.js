import { faastify } from "../src/faast";
import * as m from "./module";

async function main() {
    const cloudFunc = await faastify("aws", m, "./module");

    const result = await cloudFunc.functions.hello("world");
    const cost = await cloudFunc.costEstimate();

    console.log(`Result: ${result}\n`);
    console.log(`${cost}`);
    await cloudFunc.cleanup();
}

main();
