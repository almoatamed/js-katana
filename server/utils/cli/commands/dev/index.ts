import { execSync } from "child_process";
import { appPath } from "../../utils/appPath/index.js";

const createCommand = (program: import("commander").Command) => {
    program
        .command("dev")
        .description("use it to run in dev mode")
        .action(async () => {
            execSync("npx nodemon", {
                stdio: "inherit",
                cwd: appPath,
            });
            process.exit(0);
        });
};
export { createCommand };
