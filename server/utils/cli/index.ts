#! /usr/bin/env bun
import { execSync } from "child_process";
import { program } from "commander";
import { readVolatileJSON } from "kt-common";
import { createLogger } from "kt-logger";
import path from "path";

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
            const kiPackageDotJson: (typeof import("../../../package.json")) | null = readVolatileJSON(kiPackageDotJsonFile);
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
            if (useBun) {
                log("Starting server in development mode using bun...");
                execSync("bun --watch run ./run.js", {
                    cwd: path.join(import.meta.dirname, "../.."),
                    stdio: "inherit",
                    encoding: "utf-8",
                });
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

    await program.parseAsync();
};
await run();
process.exit(0);
