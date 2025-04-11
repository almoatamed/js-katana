import { getFromEnv } from "../dotEnv.js";
import { EncryptionConfig } from "./encryptionConfigType.js";

export const encryptionConfig: EncryptionConfig = {
    getSaltOrRounds: () => {
        const result = getFromEnv("SALT_OR_ROUNDS");
        if (result) {
            if (Number(result)) {
                return Number(result);
            }
            return result;
        }
        return 10;
    },
    getJwtSecret() {
        const result = getFromEnv("JWT_SECRET");
        if (result) {
            return result;
        }
        console.error("there is no jwt secret in your environment, please set JWT_SECRET in your .env");
        process.exit(1);
    },
    getDescriptionsSecret() {
        const result = getFromEnv("DESCRIPTIONS_SECRET");
        if (result) {
            return result;
        }
        console.error(
            "there is no description secret in your environment, please set DESCRIPTIONS_SECRET in your .env",
        );
        process.exit(1);
    },
    getJwtOptions() {
        return {
            expiresIn: "2 DAY",
        };
    },
};
encryptionConfig.getJwtSecret();
encryptionConfig.getDescriptionsSecret();
