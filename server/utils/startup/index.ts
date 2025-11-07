import { getSourceDir, loadConfig, valueOf } from "../loadConfig/index.js";
import type { Application } from "express";

const fs = (await import("fs")).default;
const url = (await import("url")).default;
const path = (await import("path")).default;
const cluster = (await import("cluster")).default;

const getStartupDir = async () => {
    const root = await getSourceDir();
    const config = await loadConfig();
    return path.join(root, (await valueOf(config.getStartupDirPath)) || "./startup");
};

const startupDir = await getStartupDir();

const loadStartup = async function (app: Application, root = startupDir) {
    if(!fs.existsSync(root)){
        console.warn(`Startup directory not found at path: ${root}`);
        return;
    }
    const directoryContent = fs.readdirSync(root).sort();

    for (const item of directoryContent) {
        if (!cluster.isPrimary) {
            return;
        }
        const itemAbsolutePath = path.join(root, item);

        const itemStats = fs.statSync(itemAbsolutePath);
        if (itemStats.isDirectory()) {
            await loadStartup(app, itemAbsolutePath);
        } else {
            if (item.endsWith(".run.js") || item.endsWith(".run.ts")) {
                const run = (await import(url.pathToFileURL(itemAbsolutePath).toString())).run;
                if (typeof run == "function") {
                    await run(app);
                }
            }
        }
    }
};

export default loadStartup;
