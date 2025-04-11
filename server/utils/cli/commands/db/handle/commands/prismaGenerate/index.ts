import { execSync } from "child_process";
import { appPath } from "../../../../../utils/appPath/index.js";

const createCommand = (program: import("commander").Command) => {
    program
        .command("prisma-generate")
        .alias("pg")
        .description("run prisma generate")
        .action(() => {
            try {
                execSync(`prisma generate --schema=./prisma/mainSchema.prisma`, {
                    cwd: appPath,
                    stdio: "inherit",
                });
            } catch (error) {
                execSync(`npx prisma generate --schema=./prisma/mainSchema.prisma`, {
                    cwd: appPath,
                    stdio: "inherit",
                });
            }
        });
};
export { createCommand };
