import * as cloudify from "../src/cloudify";
import { checkResourcesCleanedUp, checkResourcesExist, getResources } from "./util";

test(
    "removes ephemeral resources",
    async () => {
        const cloud = cloudify.create("google");
        const func = await cloud.createFunction("./functions", { useQueue: true });
        checkResourcesExist(await getResources(func));
        await func.cleanup();
        checkResourcesCleanedUp(await getResources(func));
    },
    120 * 1000
);
