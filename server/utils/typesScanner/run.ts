import { execSync } from "child_process";
import { getDescriptionPreExtensionSuffix, getRouterDirectory } from "../loadConfig/index.js";
import { routerSuffixRegx } from "../routersHelpers/matchers.js";
import { processRoutesForTypes } from "./index.js";
import cluster from "cluster";

const collectRoutesFiles = async () => {
    const routerDirectory = await getRouterDirectory();
    const fs = (await import("fs/promises")).default;
    const path = (await import("path")).default;

    const routesFilesMap: { [key: string]: string } = {};
    const descriptionPreExtensionSuffix = await getDescriptionPreExtensionSuffix();
    const toBeDeletedDescriptions: string[] = [];

    const traverseDirectory = async (directory: string) => {
        const items = await fs.readdir(directory, { withFileTypes: true });

        for (const item of items) {
            const itemPath = path.join(directory, item.name);
            if (item.isDirectory()) {
                await traverseDirectory(itemPath);
            } else {
                const routerMatch = item.name.match(routerSuffixRegx);
                if (!routerMatch) {
                    continue;
                }
                const routerName = item.name.slice(0, item.name.indexOf(routerMatch[0]));
                toBeDeletedDescriptions.push(path.join(directory, `${routerName}${descriptionPreExtensionSuffix}.md`));
                routesFilesMap[itemPath] = itemPath;
            }
        }
    };
    await traverseDirectory(routerDirectory);

    const command = `rm -f ${toBeDeletedDescriptions.join(" ")}`;
    execSync(command, { shell: "/bin/bash" });
    return routesFilesMap;
};

export const runTypesScanner = async () => {
    if (!cluster.isPrimary) {
        return;
    }
    const routesFilesMap = await collectRoutesFiles();
    await processRoutesForTypes(routesFilesMap);
};
await runTypesScanner();
