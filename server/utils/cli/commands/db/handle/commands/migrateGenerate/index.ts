import { execSync } from "child_process";
import { appPath } from "../../../../../utils/appPath/index.js";

const createCommand = (program: import("commander").Command) => {
    program
        .command("migrate-generate")
        .alias("m+")
        .description("generate main schema & run prisma migrate")
        .action(() => {
            execSync(`bun ./server/utils/cli/commands/db/handle/commands/generateMainSchema.ts`, {
                cwd: appPath,
                stdio: "inherit",
            });
            try {
                execSync("prisma migrate dev --schema=./prisma/mainSchema.prisma", {
                    cwd: appPath,
                    stdio: "inherit",
                });
            } catch (error) {
                execSync("npx prisma migrate dev --schema=./prisma/mainSchema.prisma", {
                    cwd: appPath,
                    stdio: "inherit",
                });
            }
        });
};
export { createCommand };
