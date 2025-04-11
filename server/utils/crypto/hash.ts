import { createHash } from "node:crypto";

export const hashWithSHA256 = (data: string) => {
    return createHash("sha256").update(data).digest("hex");
};
