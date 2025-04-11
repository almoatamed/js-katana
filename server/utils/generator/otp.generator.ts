import { randomBytes } from "node:crypto";

export const generateOTP = () => {
    return randomBytes(6).toString("hex").slice(0, 6).toUpperCase();
};
