import rootPaths from "../dynamicConfiguration/rootPaths.js";

// @ts-nocheck
const fs = (await import("fs")).default;
const url = (await import("url")).default;
const path = (await import("path")).default;
const cluster = (await import("cluster")).default;
const srcPath = rootPaths.srcPath;

const loadStartup = async function (app, root = path.join(srcPath, "startup")) {
    const directoryContent = fs.readdirSync(root).sort();

    for (const item of directoryContent) {
        const itemAbsolutePath = path.join(root, item);

        const itemStats = fs.statSync(itemAbsolutePath);
        if (itemStats.isDirectory()) {
            await loadStartup(app, itemAbsolutePath);
        } else {
            if (cluster.isPrimary && (item.endsWith(".run.js") || item.endsWith(".run.ts"))) {
                const run = (await import(url.pathToFileURL(itemAbsolutePath).toString())).run;
                if (typeof run == "function") {
                    await run(app);
                }
            }
        }
    }
};

export default loadStartup;
