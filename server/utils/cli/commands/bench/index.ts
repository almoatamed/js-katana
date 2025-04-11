import { execSync } from "child_process";
import { appPath } from "../../utils/appPath/index.js";

const createCommand = (program: import("commander").Command) => {
    program
        .command("bench")
        .alias("bn")
        .description("use it to run performance benchmarks")
        .option("-p, --pattern <value>", "pattern to filter benchmarks with with", "")
        .action(async ({ pattern }) => {
            if (!pattern) {
                console.error("No pattern provided");
                return;
            }
            execSync(`rest l && NODE_ENV=test npx vitest bench ${pattern} --watch=false`, {
                stdio: "inherit",
                cwd: appPath,
            });
            process.exit(0);
        });
};
export { createCommand };
