import { AxiosPromise } from "axios";
import { GoogleApis, cloudfunctions_v1 as gcf, google } from "googleapis";
import humanStringify from "human-stringify";

export async function initializeGoogleAPIs() {
    const auth = await google.auth.getClient({
        scopes: ["https://www.googleapis.com/auth/cloud-platform"]
    });

    const project = await google.auth.getDefaultProjectId();
    google.options({ auth });
    return google;
}

export function sleep(ms: number) {
    return new Promise<void>(resolve => setTimeout(resolve, ms));
}

export interface PollOptions {
    maxRetries?: number;
    verbose?: boolean;
    operation?: string;
    delay?: (retries: number) => Promise<void>;
}

export interface PollConfig<T> extends PollOptions {
    request: () => Promise<T>;
    checkDone: (result: T) => boolean;
    describe?: (result: T) => string;
}

export async function defaultPollDelay(_retries: number) {
    return sleep(5 * 1000);
}

export function defaultDescribe<T>(result: T): string {
    return humanStringify(result, { maxDepth: 2 });
}

export async function poll<T>({
    request,
    checkDone,
    describe = defaultDescribe,
    delay = defaultPollDelay,
    maxRetries = 10,
    verbose = false,
    operation = ""
}: PollConfig<T>): Promise<T | undefined> {
    let retries = 0;
    await delay(retries);
    while (true) {
        verbose && console.log(`Polling ${operation}`);
        //console.group();
        try {
            const result = await request();
            verbose && describe && console.log(`response: ${describe(result)}`);
            if (checkDone(result)) {
                verbose && console.log(`Done.`);
                return result;
            }
            if (retries++ >= maxRetries) {
                verbose && console.log(`Timed out after ${retries} attempts.`);
                return;
            }
            verbose && console.log(`not done, retrying...`);
            await delay(retries);
        } finally {
            // console.groupEnd();
        }
    }
}

interface HasNextPageToken {
    nextPageToken?: string;
}

export async function* googlePagedIterator<T extends HasNextPageToken>(
    request: (token: string | undefined) => AxiosPromise<T>
): AsyncIterableIterator<T> {
    let pageToken: string | undefined;
    do {
        const result = await request(pageToken);
        pageToken = result.data.nextPageToken;
        yield result.data;
    } while (pageToken);
}

export async function unwrap<T>(promise: AxiosPromise<T>) {
    let result = await promise;
    return result.data;
}

export class CloudFunctions {
    gCloudFunctions: gcf.Cloudfunctions;

    constructor(
        private google: GoogleApis,
        private project: string,
        public verbose: boolean = false
    ) {
        this.gCloudFunctions = google.cloudfunctions("v1");
    }

    async waitForOperation(operation: gcf.Schema$Operation) {
        const name = operation.name!;
        return poll({
            request: () => this.getOperation(name),
            checkDone: result => {
                if (result.error) {
                    const err = result.error;
                    let msg = err.message;
                    if (err.details) {
                        msg += "\n" + err.details.join("\n");
                    }
                    throw new Error(msg);
                }
                return result.done || false;
            },
            describe: result => `done? ${result.done || false}`,
            operation: `${operation.metadata.type} on ${operation.metadata.target}`,
            verbose: this.verbose
        });
    }

    getOperation(name: string) {
        return unwrap(this.gCloudFunctions.operations.get({ name }));
    }

    async *listOperations(name: string) {
        yield* googlePagedIterator(pageToken =>
            this.gCloudFunctions.operations.list({ name, pageToken })
        );
    }

    async *listLocations(name: string) {
        yield* googlePagedIterator(pageToken =>
            this.gCloudFunctions.projects.locations.list({ name, pageToken })
        );
    }

    callFunction(path: string, data?: string) {
        return unwrap(
            this.gCloudFunctions.projects.locations.functions.call({
                name: path,
                requestBody: { data }
            })
        );
    }

    async createFunction(location: string, func: gcf.Schema$CloudFunction) {
        const operation = await this.gCloudFunctions.projects.locations.functions.create(
            {
                location,
                requestBody: func
            },
            {}
        );

        await this.waitForOperation(operation.data);
    }

    async deleteFunction(path: string) {
        const response = await this.gCloudFunctions.projects.locations.functions.delete({
            name: path
        });

        await this.waitForOperation(response.data);
    }

    generateDownloadUrl(name: string, versionId?: string) {
        return unwrap(
            this.gCloudFunctions.projects.locations.functions.generateDownloadUrl({
                name,
                requestBody: { versionId }
            })
        );
    }

    async generateUploaddUrl(parent: string) {
        return unwrap(
            this.gCloudFunctions.projects.locations.functions.generateUploadUrl({
                parent
            })
        );
    }

    getFunction(name: string) {
        return unwrap(this.gCloudFunctions.projects.locations.functions.get({ name }));
    }

    async *listFunctions(parent: string) {
        yield* googlePagedIterator(pageToken =>
            this.gCloudFunctions.projects.locations.functions.list({
                parent,
                pageToken
            })
        );
    }

    locationPath(location: string) {
        return `projects/${this.project}/locations/${location}`;
    }

    functionPath(location: string, funcname: string) {
        return `projects/${this.project}/locations/${location}/functions/${funcname}`;
    }

    async patchFunction(
        name: string,
        func: gcf.Schema$CloudFunction,
        updateMask?: string
    ) {
        console.warn(
            `Patching cloud functions is not recommended - the update is not atomic.`
        );
        const previousFunc = await this.getFunction(name);
        const response = await this.gCloudFunctions.projects.locations.functions.patch({
            name,
            updateMask,
            requestBody: func
        });
        await this.waitForOperation(response.data);
    }
}
