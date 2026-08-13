import type { RoutingConfig } from "js-kt";

export default {
    getPort: 3001,
    runSingle: true,
    httpAdapter: "bun",
    isDev: false,
    autoDescribe: false,
} satisfies RoutingConfig;
