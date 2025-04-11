import { getFromEnv } from "../dotEnv.js";
import { CorpConfig } from "./corpConfigTypes.js";

export const corpConfig = {
    getCorpLogo() {
        return getFromEnv("SASS_PROVIDER_LOGO_FILE_PATH_FROM_ASSET_IMAGES");
    },
    getCorpLogoUrl() {
        return getFromEnv("SASS_PROVIDER_LOGO_URL");
    },
    getCorpName() {
        return getFromEnv("SASS_PROVIDER_NAME");
    },
} satisfies CorpConfig;
