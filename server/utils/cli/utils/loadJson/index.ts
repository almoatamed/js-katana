import fs from "fs";

const loadJson = (jsonPath: string): any => {
    let json = fs.readFileSync(jsonPath, "utf-8");
    json = json
        .split("\n")
        .filter((line) => {
            return !line.match(/^\s*?\/\//);
        })
        .join("\n");
    json = json.replaceAll(/\/\*(.|\n)*?\*\//g, "");
    json = json.replaceAll(/\,((\s|\n)*?(?:\}|\]))/g, "$1");
    json = JSON.parse(json);
    return json;
};
export { loadJson };
