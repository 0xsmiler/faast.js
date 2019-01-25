import { getOptions } from "loader-utils";
import { WrapperOptions } from "./wrapper";
import { logProvider } from "./log";

export interface LoaderOptions {
    trampolineFactoryModule: string;
    functionModule: string;
    wrapperOptions: WrapperOptions;
}

export default function webpackLoader(this: any, _source: string) {
    const options = getOptions(this);
    const rv = `
            const trampolineFactory = require(${options.trampolineFactoryModule});
            const fModule = require(${options.functionModule});
            const Wrapper = require("${require.resolve("./wrapper")}").Wrapper;
            const wrapped = new Wrapper(fModule, ${options.wrapperOptions});
            module.exports = trampolineFactory.makeTrampoline(wrapped);
`;
    logProvider(`trampoline {${rv}}`);
    return rv;
}
