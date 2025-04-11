import { getFromEnv } from "../dotEnv.js";
import { HostingConfig } from "./hostingConfig.js";

export const hostingConfig = {
    getServerName() {
        return getFromEnv("SERVER_NAME") || "localhost"
    },

    getPort: () => {
        const port = Number(getFromEnv("PORT"));
        if (port) {
            return port;
        }
        return 3000;
    },
} satisfies HostingConfig