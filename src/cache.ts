import { homedir } from "os";
import { join } from "path";
import { Readable } from "stream";
import { exists, mkdir, readdir, readFile, rmrf, stat, writeFile, rename } from "./fs";
import * as uuidv4 from "uuid/v4";

interface Blob {}

/**
 * A simple persistent key-value store. Entries can be expired, but are not
 * actually deleted individually. The entire cache can be deleted at once. Hence
 * this cache is useful for storing results that are expensive to compute but do
 * not change too often (e.g. the node_modules folder from an 'npm install'
 * where 'package.json' is not expected to change too often)
 *
 * @public
 */
export class PersistentCache {
    private initialized: Promise<void>;

    private async initialize(dir: string) {
        if (!(await exists(dir))) {
            await mkdir(dir, { mode: 0o700, recursive: true });
        }
    }

    readonly dir: string;

    /**
     * @param {string} dirRelativeToHomeDir The directory under the user's home
     * directory that will be used to store cached values. The directory will be
     * created if it doesn't exist.
     * @param {number} [expiration=24 * 3600 * 1000] The age (in seconds) after
     * which a cached entry is invalid
     */
    constructor(
        readonly dirRelativeToHomeDir: string,
        readonly expiration: number = 24 * 3600 * 1000
    ) {
        this.dir = join(homedir(), dirRelativeToHomeDir);
        this.initialized = this.initialize(this.dir);
    }

    /**
     * Retrieves the value previously set for the given key, or undefined if the
     * key is not found.
     */
    async get(key: string) {
        await this.initialized;
        const entry = join(this.dir, key);
        const statEntry = await stat(entry).catch(_ => {});
        if (statEntry) {
            if (Date.now() - statEntry.mtimeMs > this.expiration) {
                return undefined;
            }
            return readFile(entry).catch(_ => {});
        }
        return undefined;
    }

    async set(key: string, value: Buffer | string | Uint8Array | Readable | Blob) {
        await this.initialized;
        const entry = join(this.dir, key);
        const tmpEntry = join(this.dir, uuidv4());
        await writeFile(tmpEntry, value, { mode: 0o600, encoding: "binary" });
        await rename(tmpEntry, entry);
    }

    /**
     * Retrieve all keys stored in the cache, including expired entries.
     */
    entries() {
        return readdir(this.dir);
    }

    /**
     * Deletes all cached entries from disk.
     */
    async clear({ leaveEmptyDir = true } = {}) {
        await this.initialized;

        await rmrf(this.dir);

        if (leaveEmptyDir) {
            await mkdir(this.dir, { mode: 0o700, recursive: true });
        }
    }
}

const days = 24 * 3600 * 1000;

export const caches = {
    awsPackage: new PersistentCache(".faast/aws/packages", 7 * days),
    awsPrices: new PersistentCache(".faast/aws/pricing", 1 * days),
    googlePrices: new PersistentCache(".faast/google/pricing", 1 * days)
};
