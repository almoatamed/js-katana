import { execSync } from "child_process";
import { appPath } from "../../../../../utils/appPath/index.js";

const createCommand = (program: import("commander").Command) => {
    program
        .command("deploy")
        .alias("d")
        .description("run prisma migrate deploy")
        .action(() => {
            execSync(`rest db ms+`, {
                cwd: appPath,
                stdio: "inherit",
            });
            try {
                execSync(`prisma migrate deploy --schema=./prisma/mainSchema.prisma `, {
                    cwd: appPath,
                    stdio: "inherit",
                });
            } catch (error) {
                execSync(`npx prisma migrate deploy --schema=./prisma/mainSchema.prisma `, {
                    cwd: appPath,
                    stdio: "inherit",
                });
            }

            execSync(`rest db pg`, {
                cwd: appPath,
                stdio: "inherit",
            }); 
        });
};
export { createCommand };
