import { getFromEnv } from "../dotEnv.js";
import { AppIdentity } from "./appIdentityConfig.js";

export const appIdentityConfig = {
    getLogo() {
        return getFromEnv("APP_LOGO_FILE_PATH_FROM_ASSET_IMAGES");
    },
    getLogoUrl(){
        return getFromEnv("APP_LOGO_URL") 
    },
    getName(){
        return getFromEnv("APP_NAME")
    }
} satisfies AppIdentity;
