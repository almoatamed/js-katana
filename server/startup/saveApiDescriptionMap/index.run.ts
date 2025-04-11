import cluster from "cluster";
import fs from "fs";
import path from "path";
import { descriptionsMap as eventsDescriptionMap } from "../../utils/channelsHelpers/describe/emitter/index.js";
import { descriptionsMap as channelsDescriptionMap } from "../../utils/channelsHelpers/describe/listener/index.js";
import rootPaths from "../../utils/dynamicConfiguration/rootPaths.js";
import { descriptionsMap } from "../../utils/routersHelpers/describe/index.js";
export const run = async () => {
    if (cluster.isPrimary) {
        fs.writeFileSync(
            path.join(rootPaths.srcPath, "/assets/apiDescriptionMap.json"),
            JSON.stringify(descriptionsMap, null, 4),
        );
        fs.writeFileSync(
            path.join(rootPaths.srcPath, "/assets/channelsDescriptionMap.json"),
            JSON.stringify(channelsDescriptionMap, null, 4),
        );
        fs.writeFileSync(
            path.join(rootPaths.srcPath, "/assets/eventsDescriptionMap.json"),
            JSON.stringify(eventsDescriptionMap, null, 4),
        );
    }
};
