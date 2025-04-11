import { getFromEnv } from "../dotEnv.js";
import { EnvConfigType } from "./envTypes.js";

export const envConfig: EnvConfigType = {
    getEnv() {
        const env = String(getFromEnv("ENV") || "");
        const isDev = !!["dev", "d", "development", "devel", "de"].includes(env.toLowerCase());
        if(isDev){
            return "development"
        }
        return "production"
    },
};
