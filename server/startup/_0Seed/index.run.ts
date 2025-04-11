import { localLogDecorator } from "$/server/utils/log/index.js";

const log = await localLogDecorator("Main Seeder", "blue", true, "Info");

const seederPathsList = ["./seeders/addresses.seeder.js", "./seeders/superAdmin.seeder.js"];
const run = async function (app) {
    for (const path of seederPathsList) {
        log("running production seeder: ", path);
        const run = (await import(path)).run;
        if (typeof run == "function") {
            await run(app);
        }
    }
};

export { run };
