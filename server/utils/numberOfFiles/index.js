import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import url from "url";
const appPath = path.resolve(path.join(path.dirname(url.fileURLToPath(import.meta.url)), "../../../."));

// const data  = fs.readFileSync('./listOfFiles.txt', 'utf-8')
const data = execSync("find " + appPath, {
    maxBuffer: 10e6,
})
    .toString()
    .trim();

const files = data.split("\n").filter((file) => {
    return (
        !file.includes("node_modules") &&
        !file.includes(".git") &&
        !file.includes("/just/") &&
        !file.includes("/js-xlsx-master/") &&
        !file.includes("/dist/") &&
        !file.includes("/public/")
    );
});
fs.writeFileSync("./listOfFiles.txt", files.join("\n"));

let numberOfLines = 0;
for (const file of files) {
    try {
        numberOfLines += Math.floor(Number(execSync(`wc ${file} -l`).toString().trim().split(" ")[0]));
    } catch (error) {}
}
console.log(numberOfLines);
fs.writeFileSync("./numberOfLines.txt", numberOfLines.toString());
// /**
//  * 220377 lines of code
//  */
