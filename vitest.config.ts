import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        alias: {
            "$/": new URL(".", import.meta.url).pathname,
        },
        setupFiles: ["test-setup.ts"],
        environment: "node",
        hookTimeout: 60e3,
        maxConcurrency: 1,
        watchExclude: ["./server/env.json"],
    },
});
