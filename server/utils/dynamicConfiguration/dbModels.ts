import makeThreadedJson, { JSONSourceFilePath, Options } from "$/server/utils/dynamicJson/threadedJson.js";
import cluster from "cluster";
import fs from "fs";
import url from "url";
const jsonPath = url.fileURLToPath(new url.URL(`./dbModels.json`, import.meta.url));
if (cluster.isPrimary) {
    if (!fs.existsSync(jsonPath)) {
        fs.writeFileSync(
            jsonPath,
            JSON.stringify(
                {
                    db: {
                        models: {},
                        modelsArray: [],
                        capModelsArray: [],
                    },
                },
                null,
                4,
            ),
        );
    }
}

const store = await makeThreadedJson<{
    db: {
        models: { [key: string]: string };
        modelsArray: string[];
        capModelsArray: string[];
    };
}, JSONSourceFilePath, Options<JSONSourceFilePath>>(jsonPath as JSONSourceFilePath, {
    uniqueEventNumber: "dbModels",
    broadcastOnUpdate: true,
    lazy: false,
});

const dbModels = store;

export default dbModels;
export { dbModels, store };
