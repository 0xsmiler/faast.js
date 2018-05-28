import humanStringify from "human-stringify";
import { AnyFunction, FunctionCall, FunctionReturn } from "../cloudify";

const funcs: { [func: string]: AnyFunction } = {};

export function registerFunction(fn: AnyFunction, name?: string) {
    name = name || fn.name;
    if (!name) {
        throw new Error("Could not register function without name");
    }
    funcs[name] = fn;
}

export function registerAllFunctions(obj: { [name: string]: AnyFunction }) {
    for (const name of Object.keys(obj)) {
        registerFunction(obj[name], name);
    }
}

export async function trampoline(
    event: any,
    context: any,
    callback: (err: Error | null, obj: object) => void
) {
    console.log(`${humanStringify(event)}`);
    try {
        const { name, args } = event as FunctionCall;
        if (!name) {
            throw new Error("Invalid function call request");
        }

        const func = funcs[name];
        if (!func) {
            throw new Error(`Function named "${name}" not found`);
        }

        if (!args) {
            throw new Error("Invalid arguments to function call");
        }

        console.log(`func: ${name}, args: ${humanStringify(args)}`);

        const rv = await func.apply(undefined, args);

        callback(null, {
            type: "returned",
            value: rv
        } as FunctionReturn);
    } catch (err) {
        const errObj = {};
        Object.getOwnPropertyNames(err).forEach(name => (errObj[name] = err[name]));
        console.log(`errObj: ${humanStringify(errObj)}`);
        callback(null, {
            type: "error",
            value: errObj
        } as FunctionReturn);
    }
}
