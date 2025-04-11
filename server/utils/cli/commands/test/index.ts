import { execSync } from "child_process";
import { appPath } from "../../utils/appPath/index.js";

const createCommand = (program: import("commander").Command) => {
    program
        .command("test")
        .alias("t")
        .description("use it to run te.js")
        .option("-p, --pattern <value>", "pattern to filter tests with", "")
        .option("-w, --watch", "Whether or not to run tests in watch mode", "")
        .action(async ({ pattern, watch }) => {
            execSync(`rest l && NODE_ENV=test npx vitest ${pattern} --watch=${!!watch}`, {
                stdio: "inherit",
                cwd: appPath,
            });
            process.exit(0);
        });
};
export { createCommand };
