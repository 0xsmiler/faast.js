require("source-map-support").install();

import * as aws from "./aws/aws-cloudify";
import * as google from "./google/google-cloudify";
import { PackerResult } from "./packer";
import { AnyFunction, Unpacked } from "./type-helpers";

export interface ResponseDetails<D> {
    value?: D;
    error?: Error;
    rawResponse: any;
}

export type Response<D> = ResponseDetails<Unpacked<D>>;

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

export interface CreateFunctionOptions<CloudSpecificOptions> {
    timeout?: number;
    memorySize?: number;
    cloudSpecific?: CloudSpecificOptions;
    useQueue?: boolean;
}

export class Cloud<O, S> {
    name: string = this.impl.name;
    constructor(readonly impl: CloudImpl<O, S>) {}
    cleanupResources(resources: string): Promise<void> {
        return this.impl.cleanupResources(resources);
    }
    pack(fmodule: string): Promise<PackerResult> {
        return this.impl.pack(resolve(fmodule));
    }

    async createFunction(
        fmodule: string,
        options: CreateFunctionOptions<O> = {}
    ): Promise<CloudFunction<S>> {
        const optionsImpl: O = this.impl.translateOptions(options);
        return new CloudFunction(
            this.impl.getFunctionImpl(),
            await this.impl.initialize(resolve(fmodule), optionsImpl)
        );
    }
}

export class CloudFunction<S> {
    cloudName = this.impl.name;
    constructor(readonly impl: CloudFunctionImpl<S>, readonly state: S) {}
    cloudifyWithResponse<F extends AnyFunction>(fn: F) {
        return this.impl.cloudifyWithResponse(this.state, fn);
    }
    cleanup() {
        return this.impl.cleanup(this.state);
    }
    cancelAll() {
        return this.impl.cancelWithoutCleanup(this.state);
    }
    getResourceList() {
        return this.impl.getResourceList(this.state);
    }
    getState() {
        return this.state;
    }
    setConcurrency(maxConcurrentExecutions: number): Promise<void> {
        return this.impl.setConcurrency(this.state, maxConcurrentExecutions);
    }

    cloudify<F extends AnyFunction>(fn: F): PromisifiedFunction<F> {
        const cloudifiedFunc = async (...args: any[]) => {
            const cfn = this.cloudifyWithResponse<F>(fn) as any;
            const response: Response<ReturnType<F>> = await cfn(...args);
            if (response.error) {
                throw response.error;
            }
            return response.value;
        };
        return cloudifiedFunc as any;
    }

    cloudifyAll<M>(module: M): Promisified<M> {
        const rv: any = {};
        for (const name of Object.keys(module)) {
            if (typeof module[name] === "function") {
                rv[name] = this.cloudify(module[name]);
            }
        }
        return rv;
    }

    cloudifyAllWithResponse<M>(module: M): Responsified<M> {
        const rv: any = {};
        for (const name of Object.keys(module)) {
            if (typeof module[name] === "function") {
                rv[name] = this.cloudifyWithResponse(module[name]);
            }
        }
        return rv;
    }
}

export class AWS extends Cloud<aws.Options, aws.State> {
    constructor() {
        super(aws);
    }
}

export class AWSLambda extends CloudFunction<aws.State> {}

export class Google extends Cloud<google.Options, google.State> {
    constructor() {
        super(google);
    }
}

export class GoogleEmulator extends Cloud<google.Options, google.State> {
    constructor() {
        const googleEmulator = {
            ...google,
            initialize: google.initializeEmulator
        };
        super(googleEmulator);
    }
}

export class GoogleCloudFunction extends CloudFunction<google.State> {}

const resolve = (module.parent!.require as NodeRequire).resolve;

export function create(cloudName: "aws"): AWS;
export function create(cloudName: "google"): Google;
export function create(cloudName: "google-emulator"): GoogleEmulator;
export function create(cloudName: string): Cloud<any, any>;
export function create(cloudName: string): Cloud<any, any> {
    if (cloudName === "aws") {
        return new AWS();
    } else if (cloudName === "google") {
        return new Google();
    } else if (cloudName === "google-emulator") {
        return new GoogleEmulator();
    }
    throw new Error(`Unknown cloud name: "${cloudName}"`);
}

export interface CloudImpl<O, S> {
    name: string;
    initialize(serverModule: string, options?: O): Promise<S>;
    cleanupResources(resources: string): Promise<void>;
    pack(functionModule: string): Promise<PackerResult>;
    translateOptions(options?: CreateFunctionOptions<O>): O;
    getFunctionImpl(): CloudFunctionImpl<S>;
}

export interface CloudFunctionImpl<State> {
    name: string;
    cloudifyWithResponse<F extends AnyFunction>(
        state: State,
        fn: F
    ): ResponsifiedFunction<F>;
    cleanup(state: State): Promise<void>;
    cancelWithoutCleanup(state: State): Promise<void>;
    getResourceList(state: State): string;
    setConcurrency(state: State, maxConcurrentExecutions: number): Promise<void>;
}
