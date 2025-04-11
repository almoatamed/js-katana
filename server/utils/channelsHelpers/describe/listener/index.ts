import { AuthorizationOption } from "$/server/middlewares/authorize.middleware.js";
import { lockMethod } from "$/server/utils/common/index.js";
import {
    routerSuffixRegx as channelsSuffixRegx,
    descriptionSuffixRegx,
} from "$/server/utils/routersHelpers/matchers.js";
import cluster from "cluster";
import fs from "fs";
import path from "path";
import ts from "typescript";
import url from "url";
import { routerConfig } from "../../../../config/routing/index.js";
import rootPaths from "../../../dynamicConfiguration/rootPaths.js";
export type DescriptionProps = {
    fileUrl: string;
    path?: string;
    fullChannelPath?: string;
    requiresAuth?: boolean;
    requiresAuthorities?: {
        allow?: AuthorizationOption;
        reject?: AuthorizationOption;
    };
    descriptionText?: string;
    requestBodyTypeString?: string;
    additionalTypes?: string;
    responseBodyTypeString?: string;
    descriptionFileFullPath?: string;
};
export type ChannelDescriptionProps = DescriptionProps;

export const descriptionsMap = {} as {
    [key: string]: DescriptionProps;
};
export const channelsDescriptionsMap = descriptionsMap;
const channelsDirectory = path.join(rootPaths.srcPath, routerConfig.getRouterDirectory());

const checkType = (typeString: string) => {
    const sourceCode = `type TempType = ${typeString};`;
    eval(ts.transpile(sourceCode));
};

export const describe = lockMethod(
    (options: DescriptionProps) => {
        if (!cluster.isPrimary) {
            return;
        }
        try {
            if (options.requestBodyTypeString) {
                checkType(options.requestBodyTypeString);
            } else {
                options.requestBodyTypeString = "any";
            }

            if (options.responseBodyTypeString) {
                checkType(options.responseBodyTypeString);
            } else {
                options.responseBodyTypeString = "any";
            }

            if (!options.path) {
                options.path = "/";
            }

            const channelPath = url.fileURLToPath(options.fileUrl);
            const channelDirectory = path.dirname(channelPath);

            const channelRelativePath = url.fileURLToPath(options.fileUrl).replace(channelsDirectory, "");
            const channelRelativeDirectory = path.dirname(channelRelativePath);

            const channelFileName = path.basename(channelPath);
            const channelSuffixMatch = channelFileName.match(channelsSuffixRegx);
            if (!channelSuffixMatch) {
                console.error(
                    'Invalid Channel Name, a channel file should end with "' +
                        routerConfig.getRouteSuffix() +
                        '" provided is: ',
                    channelFileName,
                );
                throw new Error();
            }

            const channelFileNameWithoutExtension = channelFileName.slice(
                0,
                channelFileName.indexOf(channelSuffixMatch[0]),
            );

            const channelPrecisePath = path.join(
                channelFileNameWithoutExtension == "index"
                    ? channelRelativeDirectory
                    : path.join(channelRelativeDirectory, channelFileNameWithoutExtension),
                options.path || "",
            );
            console.log("Channel Full path on describe", channelPrecisePath);

            const channelDirectoryContent = fs.readdirSync(channelDirectory);
            const channelDescriptionRegx = RegExp(
                `${channelFileNameWithoutExtension}${descriptionSuffixRegx.toString().slice(1, -1)}`,
            );

            const descriptionFileName = channelDirectoryContent.find((item) => {
                const itemStats = fs.statSync(path.join(channelDirectory, item));
                if (itemStats.isFile()) {
                    if (item.match(channelDescriptionRegx)) {
                        return true;
                    }
                }
                return false;
            });
            const descriptionFileFullPath = !descriptionFileName
                ? path.join(
                      channelDirectory,
                      channelFileNameWithoutExtension + routerConfig.getDescriptionPreExtensionSuffix() + ".md",
                  )
                : path.join(channelDirectory, descriptionFileName);
            const channelDescriptionContent = `<!-- --start--channel-- ${channelPrecisePath} -->

# Channel Description 
${options.descriptionText || "No description Text Provided"}

## Channel Path: 
${channelPrecisePath}


${
    options.additionalTypes
        ? `## Defined Types: 
\`\`\`ts
${options.additionalTypes}
\`\`\``
        : ""
}



## Channel Request Body type definition:
\`\`\`ts
type RequestBody = ${options.requestBodyTypeString || "any"}
\`\`\`

## Response Content Type Definition: 
\`\`\`ts
type Response = ${options.responseBodyTypeString || "any"}
\`\`\`


<!-- --end--channel-- ${channelPrecisePath} -->`;

            if (!descriptionFileName) {
                fs.writeFileSync(descriptionFileFullPath, channelDescriptionContent);
            } else {
                const content = fs.readFileSync(descriptionFileFullPath, "utf-8");

                if (!content.includes(channelPrecisePath)) {
                    fs.writeFileSync(descriptionFileFullPath, content + "\n\n" + channelDescriptionContent);
                } else {
                    fs.writeFileSync(
                        descriptionFileFullPath,
                        content.replace(
                            RegExp(
                                `\\<\\!-- --start--channel-- ${channelPrecisePath.replaceAll("/", "\\/")} --\\>(.|\n)*?\\<\\!-- --end--channel-- ${channelPrecisePath.replaceAll("/", "\\/")} --\\>`,
                            ),
                            channelDescriptionContent,
                        ),
                    );
                }
            }

            options.fullChannelPath = channelPrecisePath;
            options.descriptionFileFullPath = path.join(channelPrecisePath, "/describe");

            if (descriptionsMap[options.fullChannelPath]) {
                console.error(
                    "Channel Descriptor Already Registered",
                    "\nNew Registration:",
                    options,
                    "\nOld Registration:",
                    descriptionsMap[options.fullChannelPath],
                );
                throw new Error();
            }
            options.fileUrl = options.fullChannelPath;
            descriptionsMap[options.fullChannelPath] = options;
        } catch (error: any) {
            console.error(error);
            console.error("CRITICAL: Invalid Channel Descriptor", options);
            process.exit(-1);
        }
    },
    {
        lockName: "settingUpChannelDescriptions",
    },
);
export const describeChannel = describe;
