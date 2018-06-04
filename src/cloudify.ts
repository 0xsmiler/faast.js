require("source-map-support").install();

import * as aws from "./aws/aws-cloudify";
import * as google from "./google/google-cloudify";
import { PackerResult } from "./packer";

export type AnyFunction = (...args: any[]) => any;

export type Unpacked<T> = T extends Promise<infer D> ? D : T;

export type PromisifiedFunction<T extends AnyFunction> =
    // prettier-ignore
    T extends () => infer D ? () => Promise<Unpacked<D>> :
    T extends (a1: infer A1) => infer D ? (a1: A1) => Promise<Unpacked<D>> :
    T extends (a1: infer A1, a2: infer A2) => infer D ? (a1: A1, a2: A2) => Promise<Unpacked<D>> :
    T extends (a1: infer A1, a2: infer A2, a3: infer A3) => infer D ? (a1: A1, a2: A2, a3: A3) => Promise<Unpacked<D>> :
    T extends (a1: infer A1, a2: infer A2, a3: infer A3, a4: infer A4) => infer D ? (a1: A1, a2: A2, a3: A3, a4: A4) => Promise<Unpacked<D>> :
    T extends (a1: infer A1, a2: infer A2, a3: infer A3, a4: infer A4, a5: infer A5) => infer D ? (a1: A1, a2: A2, a3: A3, a4: A4, a5: A5) => Promise<Unpacked<D>> :
    T extends (a1: infer A1, a2: infer A2, a3: infer A3, a4: infer A4, a5: infer A5, a6: infer A6) => infer D ? (a1: A1, a2: A2, a3: A3, a4: A4, a5: A5, a6: A6) => Promise<Unpacked<D>> :
    T extends (a1: infer A1, a2: infer A2, a3: infer A3, a4: infer A4, a5: infer A5, a6: infer A6, a7: infer A7) => infer D ? (a1: A1, a2: A2, a3: A3, a4: A4, a5: A5, a6: A6, a7: A7) => Promise<Unpacked<D>> :
    T extends (a1: infer A1, a2: infer A2, a3: infer A3, a4: infer A4, a5: infer A5, a6: infer A6, a7: infer A7, a8: infer A8) => infer D ? (a1: A1, a2: A2, a3: A3, a4: A4, a5: A5, a6: A6, a7: A7, a8: A8) => Promise<Unpacked<D>> :
    T extends (a1: infer A1, a2: infer A2, a3: infer A3, a4: infer A4, a5: infer A5, a6: infer A6, a7: infer A7, a8: infer A8, a9: infer A9) => infer D ? (a1: A1, a2: A2, a3: A3, a4: A4, a5: A5, a6: A6, a7: A7, a8: A8, a9: A9) => Promise<Unpacked<D>> :
    T extends (...args: any[]) => infer D ? (...args: any[]) => Promise<Unpacked<D>> : T;

export type Promisified<M> = {
    [K in keyof M]: M[K] extends AnyFunction ? PromisifiedFunction<M[K]> : never
};

export interface ResponseDetails<D> {
    value?: D;
    error?: Error;
    rawResponse: any;
}

export type Response<D> = ResponseDetails<Unpacked<D>>;

export type ResponsifiedFunction<T extends AnyFunction> =
    // prettier-ignore
    T extends () => infer D ? () => Promise<Response<D>> :
    T extends (a1: infer A1) => infer D ? (a1: A1) => Promise<Response<D>> :
    T extends (a1: infer A1, a2: infer A2) => infer D ? (a1: A1, a2: A2) => Promise<Response<D>> :
    T extends (a1: infer A1, a2: infer A2, a3: infer A3) => infer D ? (a1: A1, a2: A2, a3: A3) => Promise<Response<D>> :
    T extends (a1: infer A1, a2: infer A2, a3: infer A3, a4: infer A4) => infer D ? (a1: A1, a2: A2, a3: A3, a4: A4) => Promise<Response<D>> :
    T extends (a1: infer A1, a2: infer A2, a3: infer A3, a4: infer A4, a5: infer A5) => infer D ? (a1: A1, a2: A2, a3: A3, a4: A4, a5: A5) => Promise<Response<D>> :
    T extends (a1: infer A1, a2: infer A2, a3: infer A3, a4: infer A4, a5: infer A5, a6: infer A6) => infer D ? (a1: A1, a2: A2, a3: A3, a4: A4, a5: A5, a6: A6) => Promise<Response<D>> :
    T extends (a1: infer A1, a2: infer A2, a3: infer A3, a4: infer A4, a5: infer A5, a6: infer A6, a7: infer A7) => infer D ? (a1: A1, a2: A2, a3: A3, a4: A4, a5: A5, a6: A6, a7: A7) => Promise<Response<D>> :
    T extends (a1: infer A1, a2: infer A2, a3: infer A3, a4: infer A4, a5: infer A5, a6: infer A6, a7: infer A7, a8: infer A8) => infer D ? (a1: A1, a2: A2, a3: A3, a4: A4, a5: A5, a6: A6, a7: A7, a8: A8) => Promise<Response<D>> :
    T extends (a1: infer A1, a2: infer A2, a3: infer A3, a4: infer A4, a5: infer A5, a6: infer A6, a7: infer A7, a8: infer A8, a9: infer A9) => infer D ? (a1: A1, a2: A2, a3: A3, a4: A4, a5: A5, a6: A6, a7: A7, a8: A8, a9: A9) => Promise<Response<D>> :
    T extends (...args: any[]) => infer D ? (...args: any[]) => Promise<Response<D>> :T;

export type Responsified<M> = {
    [K in keyof M]: M[K] extends AnyFunction ? ResponsifiedFunction<M[K]> : never
};

export interface CommonOptions {
    timeout?: number;
    availableMemoryMb?: number;
}

export interface Cloud<O, S> {
    name: string;
    cleanupResources(resources: string): Promise<void>;
    pack(fmodule: string): Promise<PackerResult>;
    createFunction(
        fmodule: string,
        options?: O & CommonOptions
    ): Promise<CloudFunction<S>>;
}

export interface CloudFunction<S> {
    cloudName: string;
    cloudify<F extends AnyFunction>(fn: F): PromisifiedFunction<F>;
    cloudifyAll<M>(importedModule: M): Promisified<M>;
    cloudifyWithResponse<F extends AnyFunction>(fn: F): ResponsifiedFunction<F>;
    cloudifyAllWithResponse<M>(importedModule: M): Responsified<M>;
    cleanup(): Promise<void>;
    getResourceList(): string;
    getState(): S;
}

export interface AWS extends Cloud<aws.Options, aws.State> {
    createFunction(
        fmodule: string,
        options?: aws.Options & CommonOptions
    ): Promise<AWSLambda>;
}
export interface AWSLambda extends CloudFunction<aws.State> {}

export interface Google extends Cloud<google.Options, google.State> {
    createFunction(
        fmodule: string,
        options?: google.Options & CommonOptions
    ): Promise<GoogleCloudFunction>;
}
export interface GoogleCloudFunction extends CloudFunction<google.State> {}

export interface GoogleEmulator extends Google {
    createFunction(
        fmodule: string,
        options?: google.Options & CommonOptions
    ): Promise<GCFunctionEmulator>;
}
export interface GCFunctionEmulator extends CloudFunction<google.State> {}

const resolve = (module.parent!.require as NodeRequire).resolve;

export function create(cloudName: "aws"): AWS;
export function create(cloudName: "google"): Google;
export function create(cloudName: "google-emulator"): GoogleEmulator;
export function create(cloudName: string): Cloud<any, any> {
    function createCloud<O, S>(impl: CloudImpl<O, S>): Cloud<O, S> {
        return {
            name: impl.name,
            cleanupResources: impl.cleanupResources,
            pack: fmodule => impl.pack(resolve(fmodule)),
            createFunction: async (fmodule: string, options?: O) =>
                createFunctionApi(impl, await impl.initialize(resolve(fmodule), options))
        };
    }

    function createGoogleEmulator() {
        let g = createCloud(google);
        g.createFunction = async (fmodule: string, options?: google.Options) => {
            return await createFunctionApi(
                google,
                await google.initializeEmulator(resolve(fmodule), options)
            );
        };
        return g;
    }

    if (cloudName === "aws") {
        return createCloud(aws);
    } else if (cloudName === "google") {
        return createCloud(google);
    } else if (cloudName === "google-emulator") {
        return createGoogleEmulator();
    }
    throw new Error(`Unknown cloud name: "${cloudName}"`);
}

async function createFunctionApi<S>(
    cloud: CloudImpl<any, S>,
    state: S
): Promise<CloudFunction<S>> {
    function cloudify<F extends AnyFunction>(state: S, fn: F): PromisifiedFunction<F> {
        const cloudifiedFunc = async (...args: any[]) => {
            const cfn = cloud.cloudifyWithResponse<F>(state, fn) as any;
            const response: Response<ReturnType<F>> = await cfn(...args);
            if (response.error) {
                throw response.error;
            }
            return response.value;
        };
        return cloudifiedFunc as any;
    }

    function cloudifyAll<M>(state: S, module: M): Promisified<M> {
        const rv: any = {};
        for (const name of Object.keys(module)) {
            if (typeof module[name] === "function") {
                rv[name] = cloudify(state, module[name]);
            }
        }
        return rv;
    }

    function cloudifyAllWithResponse<M>(state: S, module: M): Responsified<M> {
        const rv: any = {};
        for (const name of Object.keys(module)) {
            if (typeof module[name] === "function") {
                rv[name] = cloud.cloudifyWithResponse(state, module[name]);
            }
        }
        return rv;
    }

    return {
        cloudName: cloud.name,
        cloudify: f => cloudify(state, f),
        cloudifyAll: o => cloudifyAll(state, o),
        cloudifyWithResponse: f => cloud.cloudifyWithResponse(state, f),
        cloudifyAllWithResponse: o => cloudifyAllWithResponse(state, o),
        cleanup: () => cloud.cleanup(state),
        getResourceList: () => cloud.getResourceList(state),
        getState: () => state
    };
}

export interface CloudImpl<Options, State> {
    name: string;
    initialize(serverModule: string, options?: Options): Promise<State>;
    cloudifyWithResponse<F extends AnyFunction>(
        state: State,
        fn: F
    ): ResponsifiedFunction<F>;
    cleanup(state: State): Promise<void>;
    getResourceList(state: State): string;
    cleanupResources(resources: string): Promise<void>;
    pack(functionModule: string): Promise<PackerResult>;
}
