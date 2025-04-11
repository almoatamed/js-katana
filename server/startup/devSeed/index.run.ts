
import { localLogDecorator } from "$/server/utils/log/index.js";
import { envConfig } from "../../config/env/index.js";

const log = await localLogDecorator("Dev Seeder", "green", true, "Info");

const seederPathsList = [
];

const run = async function (app) {
    if (envConfig.getEnv() != "development") {
        return;
    }
    for (const path of seederPathsList) {
        log("running dev seeder", path);
        const run = (await import(path)).run;
        if (typeof run == "function") {
            await run(app);
        }
    }
};

export { run };
