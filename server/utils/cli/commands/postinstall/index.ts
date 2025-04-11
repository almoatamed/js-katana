import { execSync } from "child_process";
import { appPath } from "../../utils/appPath/index.js";

const createCommand = (program: import("commander").Command) => {
    program
        .command("postinstall")
        .alias("pi")
        .description("use it to run post package installation script")
        .action(async () => {
            execSync("rest l", {
                stdio: "inherit",
                cwd: appPath,
            });
            try {
                execSync("nohup sleep 1 && npx prettier package.json --write & disown", {
                    stdio: "ignore",
                    cwd: appPath,
                });
            } catch (error: any) {}
            process.exit(0);
        });
};
export { createCommand };
