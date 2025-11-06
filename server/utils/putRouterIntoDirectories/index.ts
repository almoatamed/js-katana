import path from "path";
import { getRouterDirectory } from "../loadConfig/index.js";
import { descriptionSuffixRegx, routerSuffixRegx } from "../routersHelpers/matchers.js";

const fs = (await import("fs")).default;
const routersMainDirectory = await getRouterDirectory()


const moveIntoFolders = function (directory = routersMainDirectory) {
    const content = fs.readdirSync(directory);
    for (const item of content) {
        const itemAbsolutePath = path.join(directory, item);
        const itemStat = fs.statSync(itemAbsolutePath);
        if (itemStat.isDirectory()) {
            moveIntoFolders(itemAbsolutePath);
        } else {
            const routerMatch = item.match(routerSuffixRegx);
            if (routerMatch) {
                const routerName = item.slice(0, item.indexOf(routerMatch[0]));
                if (routerName != "index") {
                    fs.mkdirSync(path.join(directory, routerName));

                    fs.cpSync(itemAbsolutePath, path.join(directory, routerName, item.replace(routerName, "index")));
                    fs.rmSync(itemAbsolutePath);

                    const routerDescriptionRegx = RegExp(
                        `${routerName}${descriptionSuffixRegx.toString().slice(1, -1)}`,
                    );
                    const routerDescriptionFile = content.filter((el) => !!el.match(routerDescriptionRegx))[0];
                    if (routerDescriptionFile) {
                        fs.cpSync(
                            path.join(directory, routerDescriptionFile),
                            path.join(directory, routerName, routerDescriptionFile.replace(routerName, "index")),
                        );
                        fs.rmSync(path.join(directory, routerDescriptionFile));
                    }
                }
            }
        }
    }
};

moveIntoFolders();
