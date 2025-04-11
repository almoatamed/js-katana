import { encryptionConfig } from "../../config/encryption/index.js";

const jwt = (await import("jsonwebtoken")).default;
export default {
    generate: async (obj: any) =>
        jwt.sign(obj, await encryptionConfig.getJwtSecret(), encryptionConfig.getJwtOptions()),
    verify: async (token: string) => {
        return jwt.verify(token, await encryptionConfig.getJwtSecret());
    },
};
