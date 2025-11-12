import cluster from "cluster";
import fs from "fs";
import path from "path";
import ts from "typescript";
import url from "url";
import { getDescriptionPreExtensionSuffix, getRouteSuffix } from "../../../loadConfig/index.js";
import { descriptionSuffixRegx, routerSuffixRegx } from "../../../routersHelpers/matchers.js";

export type DescriptionProps = {
    fileUrl: string;
    event: string;
    rooms?: string[];
    descriptionText?: string;
    eventBodyTypeString: string;
    additionalTypes?: string;
    expectedResponseBodyTypeString?: string;
    descriptionFileFullPath?: string;
};
export type EventDescriptionProps = DescriptionProps;

export const descriptionsMap = {} as {
    [key: string]: DescriptionProps;
};
export const eventsDescriptionMap = descriptionsMap;

const checkType = (typeString: string) => {
    const sourceCode = `type TempType = ${typeString};`;
    // oxlint-disable-next-line no-eval
    eval(ts.transpile(sourceCode));
};

const descriptionPreExtensionSuffix = await getDescriptionPreExtensionSuffix();
const routerSuffix = await getRouteSuffix();

export const describe = (options: DescriptionProps) => {
    if (!cluster.isPrimary) {
        return;
    }
    try {
        if (options.eventBodyTypeString) {
            checkType(options.eventBodyTypeString);
        } else {
            options.eventBodyTypeString = "any";
        }

        if (options.expectedResponseBodyTypeString) {
            checkType(options.expectedResponseBodyTypeString);
        } else {
            options.expectedResponseBodyTypeString = "never";
        }

        const routePath = url.fileURLToPath(options.fileUrl);
        const routeDirectory = path.dirname(routePath);

        const routeRelativePath = url.fileURLToPath(options.fileUrl).replace(routeDirectory, "");
        const routeRelativeDirectory = path.dirname(routeRelativePath);

        const routeFileName = path.basename(routePath);

        const routeSuffixMatch = routeFileName.match(routerSuffixRegx);
        if (!routeSuffixMatch) {
            console.error(
                'Invalid Route Name, a Route file should end with "' + routerSuffix + '" provided is: ',
                routeFileName
            );
            throw new Error();
        }

        const routeFileNameWithoutExtension = routeFileName.slice(0, routeFileName.indexOf(routeSuffixMatch[0]));

        const routeDirectoryContent = fs.readdirSync(routeDirectory);
        const routeDescriptionRegx = RegExp(
            `${routeFileNameWithoutExtension}${descriptionSuffixRegx.toString().slice(1, -1)}`
        );

        const descriptionFileName = routeDirectoryContent.find((item) => {
            const itemStats = fs.statSync(path.join(routeDirectory, item));
            if (itemStats.isFile()) {
                if (item.match(routeDescriptionRegx)) {
                    return true;
                }
            }
            return false;
        });
        const descriptionFileFullPath = !descriptionFileName
            ? path.join(routeDirectory, routeFileNameWithoutExtension + descriptionPreExtensionSuffix + ".md")
            : path.join(routeDirectory, descriptionFileName);
        const eventDescriptionContent = `<!-- --start--event-- ${options.event} -->

# Event Description 
${options.descriptionText || "No description Text Provided"}

## Event: 
${options.event}


${
    options.additionalTypes
        ? `## Defined Types: 
\`\`\`ts
${options.additionalTypes}
\`\`\``
        : ""
}



## Event Body type definition:
\`\`\`ts
type EventBody = ${options.eventBodyTypeString || "any"}
\`\`\`

${
    options.expectedResponseBodyTypeString
        ? `
## Expected Response Content Type Definition: 
\`\`\`ts
type ExpectedResponseBody = ${options.expectedResponseBodyTypeString || "any"}
\`\`\``
        : ""
}


<!-- --end--event-- ${options.event} -->`;

        if (!descriptionFileName) {
            fs.writeFileSync(descriptionFileFullPath, eventDescriptionContent);
        } else {
            const content = fs.readFileSync(descriptionFileFullPath, "utf-8");

            if (!content.includes("<!-- --start--event-- " + options.event + " -->")) {
                fs.writeFileSync(descriptionFileFullPath, content + "\n\n" + eventDescriptionContent);
            } else {
                fs.writeFileSync(
                    descriptionFileFullPath,
                    content.replace(
                        RegExp(
                            `\\<\\!-- --start--event-- ${options.event.replaceAll(
                                "/",
                                "\\/"
                            )} --\\>(.|\n)*?\\<\\!-- --end--event-- ${options.event.replaceAll("/", "\\/")} --\\>`
                        ),
                        eventDescriptionContent
                    )
                );
            }
        }

        const routePrecisePath =
            routeFileNameWithoutExtension == "index"
                ? routeRelativeDirectory
                : path.join(routeRelativeDirectory, routeFileNameWithoutExtension);

        options.descriptionFileFullPath = path.join(routePrecisePath, "/describe");

        options.fileUrl = routePrecisePath;

        if (descriptionsMap[options.event]) {
            console.warn(
                "Event Descriptor Already Registered",
                "\nNew Registration:",
                options,
                "\nOld Registration:",
                descriptionsMap[options.event]
            );
        }
        descriptionsMap[options.event] = {
            ...descriptionsMap[options.event],
            ...options,
        };
    } catch (error: any) {
        console.error(error);
        console.error("CRITICAL: Invalid Event Descriptor", options);
        process.exit(-1);
    }
};
export const describeEvent = describe;
