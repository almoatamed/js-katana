import { execSync } from "child_process";
import { appPath } from "../../../../../utils/appPath/index.js";

const createCommand = (program: import("commander").Command) => {
    program
        .command("prisma-generate-main-schema")
        .alias("ms+")
        .description("generate prism main schema")
        .action(() => {
            execSync(`bun ./server/utils/cli/commands/db/handle/commands/generateMainSchema.ts`, {
                cwd: appPath,
                stdio: "inherit",
            });
        });
};
export { createCommand };
