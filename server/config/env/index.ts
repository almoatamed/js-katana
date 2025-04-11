import { getFromEnv } from "../dotEnv.js";
import { EnvConfigType } from "./envTypes.js";

export const envConfig: EnvConfigType = {
    getEnv() {
        const env = String(getFromEnv("ENV") || "");
        const isDev = !!["dev", "d", "development", "devel", "de"].includes(env.toLowerCase());
        if (isDev) {
            return "development";
        }

        const isProd = !!["prod", "p", "production", "produc","pro", "pr"].includes(env.toLowerCase());
        if (isProd) {
            return "production";
        }

        return "development";
    },
};
