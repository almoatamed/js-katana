import { collectRoutesFilesAndDeleteDescriptions, processRoutesForTypes } from "./index.js";
import cluster from "cluster";


export const runTypesScanner = async () => {
    if (!cluster.isPrimary) {
        return;
    }
    console.time("Collecting routes")
    const routesFilesMap = await collectRoutesFilesAndDeleteDescriptions();
    console.timeEnd("Collecting routes")
    await processRoutesForTypes(routesFilesMap);
};
await runTypesScanner();
