#!/usr/bin/node
import { execSync } from "child_process";
import path from "path";
import { argv } from "process";
import { fileURLToPath } from "url";

const bun = !!execSync("which bun", {
    encoding: "utf-8",
});

const currentDir = fileURLToPath(new URL("./", import.meta.url));
try {
    if (bun) {
        execSync(`bun ${path.join(currentDir, "index.js")} ${argv.slice(2).join(" ")}`, {
            stdio: "inherit",
        });
    } else {
        console.error('Please install bunjs runtime it is required to run this framework "npm i -g bun"');
        process.exit(1);
    }
} catch (error) {
    process.exit(1);
}
