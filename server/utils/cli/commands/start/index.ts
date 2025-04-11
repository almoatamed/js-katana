const appPath = (await import("../../utils/appPath/index.js")).appPath;
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import logger from "../../logger.js";
import { loadTsConfig } from "../../utils/loadTsConfig/index.js";

const createCommand = (program: import("commander").Command) => {
    program
        .command("start")
        .description("use it to run production build mode")
        .action(async () => {
            const ts = loadTsConfig();
            const buildIndexRelativePath = path.join(ts.compilerOptions.outDir || "dist", "index.js");
            if (!fs.existsSync(path.join(appPath, buildIndexRelativePath))) {
                logger.error("There is not build, build the project with 'rest b'");
                return;
            }
            const bun = execSync("which bun", {
                encoding: "utf-8",
            });

            if (bun) {
                execSync(`bun --no-warnings ${buildIndexRelativePath}`, {
                    stdio: "inherit",
                    cwd: appPath,
                });
            } else {
                execSync(`node --no-warnings ${buildIndexRelativePath}`, {
                    stdio: "inherit",
                    cwd: appPath,
                });
            }

            process.exit(0);
        });
};
export { createCommand };
