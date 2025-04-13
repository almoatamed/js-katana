import makeThreadedJson, { JSONSourceFilePath } from "$/server/utils/dynamicJson/threadedJson.js";
import cluster from "cluster";
import fs from "fs";
import url from "url";
const jsonPath = url.fileURLToPath(new url.URL(`./endpoints.json`, import.meta.url)) as JSONSourceFilePath;

if (cluster.isPrimary) {
    if (!fs.existsSync(jsonPath)) {
        fs.writeFileSync(
            jsonPath,
            JSON.stringify(
                {
                    endpoints: [],
                },
                null,
                4,
            ),
        );
    }
}

const store = await makeThreadedJson({
    source: {
        type: "jsonFile", 
        fileFullPath: jsonPath, 
    }
});

const endpoints = store;

export default endpoints;
export { endpoints, store };
