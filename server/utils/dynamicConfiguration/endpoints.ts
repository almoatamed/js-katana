import makeThreadedJson, { JSONSourceFilePath, Options } from "$/server/utils/dynamicJson/threadedJson.js";
import cluster from "cluster";
import fs from "fs";
import url from "url";
const jsonPath = url.fileURLToPath(new url.URL(`./endpoints.json`, import.meta.url));

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

const store = await makeThreadedJson<
    {
        endpoints: {
            methods: {
                [key: string]: true;
            };
            path: string;
            handlers: string[];
        }[];
    },
    JSONSourceFilePath,
    Options<JSONSourceFilePath>
>(jsonPath as JSONSourceFilePath, {
    uniqueEventNumber: "endPoints",
    broadcastOnUpdate: true,
    lazy: false,
});

const endpoints = store;

export default endpoints;
export { endpoints, store };
