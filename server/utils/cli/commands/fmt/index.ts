import { execSync } from "child_process";
import { Command } from "commander";
import { appPath } from "../../utils/appPath/index.js";

const createCommand = (program: Command) => {
    program
        .command("format")
        .alias("fmt")
        .alias("pretty")
        .description("use it to format the source code of your project.")
        .action(async () => {
            execSync("npx prettier . --write ", {
                cwd: appPath,
                stdio: "inherit",
            });
            process.exit(0);
        });
};
export { createCommand };
