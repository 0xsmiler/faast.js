import { Archiver } from "archiver";
import { Hash, createHash } from "crypto";
import * as fs from "fs";
import humanStringify from "human-stringify";
import * as path from "path";
import * as webpack from "webpack";
import { log } from "./log";
import MemoryFileSystem = require("memory-fs");
import archiver = require("archiver");
import nodeExternals = require("webpack-node-externals");

export interface PackerOptions {
    webpackOptions?: webpack.Configuration;
    packageBundling?: "usePackageJson" | "bundleNodeModules";
}

const prefix = "/dist";

interface PackerResult {
    archive: Archiver;
    hash: string;
}

export async function packer(
    entryModule: string,
    trampolineModule: string,
    { webpackOptions = {}, packageBundling = "usePackageJson" }: PackerOptions = {}
): Promise<PackerResult> {
    log(`Running webpack`);
    const entry = require.resolve(entryModule);
    const trampoline = require.resolve(trampolineModule);
    let { externals = [], ...rest } = webpackOptions;
    externals = Array.isArray(externals) ? externals : [externals];
    const config: webpack.Configuration = {
        entry: `cloudify-loader?entry=${entry}&trampoline=${trampoline}!`,
        mode: "development",
        output: {
            path: "/",
            filename: "index.js",
            libraryTarget: "commonjs2"
        },
        externals: [
            packageBundling === "usePackageJson" ? nodeExternals() : {},
            ...externals
        ],
        target: "node",
        resolveLoader: { modules: [__dirname] },
        ...rest
    };

    function addToArchive(
        fs: MemoryFileSystem,
        entry: string,
        archive: Archiver,
        hasher: Hash
    ) {
        const stat = fs.statSync(entry);
        if (stat.isDirectory()) {
            for (const subEntry of fs.readdirSync(entry)) {
                const subEntryPath = path.join(entry, subEntry);
                addToArchive(fs, subEntryPath, archive, hasher);
            }
        } else if (stat.isFile()) {
            archive.append((fs as any).createReadStream(entry), {
                name: entry
            });
            hasher.update(entry);
            hasher.update(fs.readFileSync(entry));
        }
    }

    function addPackageJson(mfs: MemoryFileSystem) {
        if (packageBundling === "usePackageJson") {
            const packageJson = JSON.parse(fs.readFileSync("package.json").toString());
            packageJson["main"] = "index.js";
            mfs.writeFileSync("/package.json", JSON.stringify(packageJson, undefined, 2));
        }
    }

    function zipAndHash(mfs: MemoryFileSystem): PackerResult {
        const archive = archiver("zip", { zlib: { level: 9 } });
        const hasher = createHash("sha256");
        addToArchive(mfs, "/", archive, hasher);
        const hash = hasher.digest("hex");
        archive.finalize();
        return { archive, hash };
    }

    return new Promise<PackerResult>((resolve, reject) => {
        const mfs = new MemoryFileSystem();
        addPackageJson(mfs);
        const compiler = webpack(config);

        compiler.outputFileSystem = mfs;
        compiler.run((err, stats) => {
            if (err) {
                reject(err);
            } else {
                log(stats.toString());
                log(`Memory filesystem: ${humanStringify(mfs.data)}`);
                resolve(zipAndHash(mfs));
            }
        });
    });
}

let fname = __filename; // defeat constant propagation; __filename is different in webpack bundles.
if (fname === "/index.js") {
    log(`Execution context within webpack bundle!`);
}
