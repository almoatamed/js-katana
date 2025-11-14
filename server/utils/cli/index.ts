#! /usr/bin/env bun
import { execSync, spawn, spawnSync } from "child_process";
import { program } from "commander";
import { readVolatileJSON } from "kt-common";
import { createLogger } from "kt-logger";
import { getConfigPath } from "locate-config-kt";
import path from "path";
import { autoDescribe, getSourceDir, isDev } from "../loadConfig/index.js";
import { writeFile } from "fs/promises";
import cluster from "cluster";

const sleep = (periodInMilliseconds: number) => {
    return new Promise<void>((resolve) => {
        setTimeout(() => {
            resolve();
        }, periodInMilliseconds);
    });
};

const hasBun = async () => {
    try {
        execSync("bun --version");
        return true;
    } catch {
        console.warn(
            "Bun is not installed or not found in PATH",
            "it is recommended to use bun for better performance"
        );
        return false;
    }
};

const log = await createLogger({
    name: "KT CLI",
    color: "cyan",
    worker: true,
    logLevel: "Info",
});
const run = async () => {
    program.option("-v, --version").action(({ version }: { version: boolean }) => {
        if (version) {
            const currentDir = import.meta.dirname;
            const kiPackageDotJsonFile = path.join(currentDir, "../../../package.json");
            const kiPackageDotJson: typeof import("../../../package.json") | null =
                readVolatileJSON(kiPackageDotJsonFile);
            if (!kiPackageDotJson?.version) {
                console.error("Could not read ki package.json version");
                process.exit(1);
            }
            log(kiPackageDotJson.version);
            return;
        }
        program.help();
    });

    program
        .command("dev")
        .alias("d")
        .description("Start the server in development mode using bun or node")
        .action(async () => {
            const useBun = await hasBun();

            const maybeSpawnTypeProcessor = async () => {
                if (!(await autoDescribe()) || !cluster.isPrimary || !(await isDev())) {
                    return;
                }
                const typeProcessorPath = path.join(import.meta.dirname, "../typesScanner/server.js");

                console.log("starting type processor server");

                const processor = spawn(useBun ? "bun" : "node", [typeProcessorPath], {
                    stdio: "inherit",
                    cwd: await getSourceDir(),
                });

                const cleanup = () => {
                    console.log("Killing type processor....");
                    if (!processor.killed) {
                        processor.kill("SIGTERM"); // graceful kill
                    }
                    console.log("type processor killed");
                };
                await sleep(1e3);
                // Handle Ctrl+C, nodemon restarts, etc.
                process.on("SIGINT", cleanup);
                process.on("SIGTERM", cleanup);
                process.on("exit", cleanup);
            };

            if (useBun) {
                log("Starting server in development mode using bun...");
                await maybeSpawnTypeProcessor();
                execSync("bun --watch run ./run.js", {
                    cwd: path.join(import.meta.dirname, "../.."),
                    stdio: "inherit",
                    encoding: "utf-8",
                });
                execSync("kill");
            } else {
                log("Starting server in development mode using node...");
                execSync("npx tsx --watch ./run.js", {
                    cwd: path.join(import.meta.dirname, "../.."),
                    stdio: "inherit",
                    encoding: "utf-8",
                });
            }
        });

    program
        .command("start")
        .alias("s")
        .description("Start the server in production mode using bun or node")
        .action(async () => {
            const useBun = await hasBun();
            if (useBun) {
                log("Starting server in production mode using bun...");
                execSync("bun run ./run.js", {
                    cwd: path.join(import.meta.dirname, "../.."),
                    stdio: "inherit",
                    encoding: "utf-8",
                });
            } else {
                log("Starting server in production mode using node...");
                execSync("node ./run.js", {
                    cwd: path.join(import.meta.dirname, "../.."),
                    stdio: "inherit",
                    encoding: "utf-8",
                });
            }
        });

    program
        .command("scan-types")
        .description("Scan and generate types")
        .action(async () => {
            const useBun = await hasBun();
            execSync(`${useBun ? "bun" : "npx tsx"} ./utils/typesScanner/run.js`, {
                cwd: path.join(import.meta.dirname, "../.."),
                stdio: "inherit",
                encoding: "utf-8",
            });
        });

    program
        .command("put-routes-in-directories")
        .alias("prid")
        .description("put routes with names (like user.router.ts) in directories (like /user/index.router.ts)")
        .action(async () => {
            const useBun = await hasBun();
            execSync(`${useBun ? "bun" : "npx tsx"} ./utils/putRouterIntoDirectories/index.js`, {
                cwd: path.join(import.meta.dirname, "../.."),
                stdio: "inherit",
                encoding: "utf-8",
            });
        });
    program
        .command("create-config")
        .description("Create a default configuration file")
        .action(async () => {
            const configPath = await getConfigPath({
                configFileNameWithExtension: "router.kt.config.ts",
            });
            if (configPath) {
                log(`Configuration file already exists at path: ${configPath}`);
                return;
            }
            const newConfigPath = path.join(await getSourceDir(), "router.kt.config.ts");

            await writeFile(
                newConfigPath,
                `import type {RoutingConfig} from "js-kt"

export default {

} satisfies RoutingConfig
            `
            );
            log(`Created default configuration file at path: ${newConfigPath}`);
        });
    await program.parseAsync();
};
await run();
process.exit(0);
