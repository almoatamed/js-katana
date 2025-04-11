import { exec } from "child_process";
import { Command } from "commander";
import { appPath } from "../../utils/appPath/index.js";

const createCommand = (program: Command) => {
    program
        .command("format")
        .alias("fmt")
        .alias("pretty")
        .description("use it to format the source code of your project.")
        .action(async () => {
            exec("npx prettier . --write ", {
                cwd: appPath,
            });
            process.exit(0);
        });
};
export { createCommand };
