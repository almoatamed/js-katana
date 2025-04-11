import { SignOptions } from "jsonwebtoken";

export type EncryptionConfig = {
    getSaltOrRounds: () => Promise<string | number> | string | number;
    getJwtSecret: () => Promise<string> | string;
    getJwtOptions: () => SignOptions | undefined;
    getDescriptionsSecret: () => Promise<string> | string;
};
