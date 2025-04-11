import { appPath } from "../../../../../utils/appPath/index.js";
import { execSync } from "child_process";

const createCommand = (program: import("commander").Command) => {
    program
        .command("migrate")
        .alias("m")
        .description("run prisma migrate")
        .action(() => {
            try {
               
            execSync(`prisma migrate dev --schema=./prisma/mainSchema.prisma `, {
                cwd: appPath,
                stdio: "inherit",
            }); 
            } catch (error) {
             
            execSync(`npx prisma migrate dev --schema=./prisma/mainSchema.prisma `, {
                cwd: appPath,
                stdio: "inherit",
            });   
            }
        });
};
export { createCommand };
