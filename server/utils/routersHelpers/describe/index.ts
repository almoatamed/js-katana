import { descriptionSuffixRegx, routerSuffixRegx } from "$/server/utils/routersHelpers/matchers.js";
import fs from "fs";
import mime from "mime-types";
import path from "path";
import ts from "typescript";
import url from "url";
import { routerConfig } from "../../../config/routing/index.js";
import { AuthorizationOption } from "../../../middlewares/authorize.middleware.js";
import { lockMethod } from "../../common/index.js";
import rootPaths from "../../dynamicConfiguration/rootPaths.js";
export type DescriptionProps = {
    fileUrl: string;
    path?: string;
    fullRoutePath?: string;
    requiresAuth?: boolean;
    requiresAuthorities?: {
        allow?: AuthorizationOption;
        reject?: AuthorizationOption;
    };
    descriptionText?: string;
    method: "all" | "get" | "put" | "post" | "delete";
    requestParamsTypeString?: string;
    requestBodyTypeString?: string;
    requestHeadersTypeString?: string;
    responseContentType?: string;
    additionalTypes?: string;
    responseBodyTypeString?: string;
    descriptionFileFullPath?: string;
};
export const descriptionsMap = {} as {
    [key: string]: DescriptionProps;
};
const routerDirectory = path.join(rootPaths.srcPath, routerConfig.getRouterDirectory());

const checkType = (typeString: string) => {
    const sourceCode = `type TempType = ${typeString};`;
    eval(ts.transpile(sourceCode));
};

export const describe = lockMethod(
    (options: DescriptionProps) => {
        try {
            if (!options.responseContentType) {
                options.responseContentType = "application/json";
            } else {
                if (!mime.extension(options.responseContentType)) {
                    console.error("Content Type Not Found", options.responseContentType);
                    throw new Error();
                }
            }

            if (options.requestBodyTypeString) {
                checkType(options.requestBodyTypeString);
            } else {
                options.requestBodyTypeString = "any";
            }

            if (options.requestHeadersTypeString) {
                checkType(options.requestHeadersTypeString);
            } else {
                options.requestHeadersTypeString = "any";
            }

            if (options.requestParamsTypeString) {
                checkType(options.requestParamsTypeString);
            } else {
                options.requestParamsTypeString = "any";
            }

            if (options.responseBodyTypeString) {
                checkType(options.responseBodyTypeString);
            } else {
                options.responseBodyTypeString = "any";
            }
            if (!options.path) {
                options.path = "/";
            }

            const routePath = url.fileURLToPath(options.fileUrl);
            const routeDirectory = path.dirname(routePath);

            const routeRelativePath = url.fileURLToPath(options.fileUrl).replace(routerDirectory, "");
            const routeRelativeDirectory = path.dirname(routeRelativePath);

            const routeFileName = path.basename(routePath);
            const routeSuffixMatch = routeFileName.match(routerSuffixRegx);
            if (!routeSuffixMatch) {
                console.error(
                    'Invalid Route Name, a route file should end with "' +
                        routerConfig.getRouteSuffix() +
                        '" provided is: ',
                    routeFileName,
                );
                throw new Error();
            }

            const routeFileNameWithoutExtension = routeFileName.slice(0, routeFileName.indexOf(routeSuffixMatch[0]));

            const routePrecisePath = path.join(
                routeFileNameWithoutExtension == "index"
                    ? routeRelativeDirectory
                    : path.join(routeRelativeDirectory, routeFileNameWithoutExtension),
                options.path || "",
            );
            const routeDirectoryContent = fs.readdirSync(routeDirectory);
            const routeDescriptionRegx = RegExp(
                `${routeFileNameWithoutExtension}${descriptionSuffixRegx.toString().slice(1, -1)}`,
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
                ? path.join(
                      routeDirectory,
                      routeFileNameWithoutExtension + routerConfig.getDescriptionPreExtensionSuffix() + ".md",
                  )
                : path.join(routeDirectory, descriptionFileName);
            const routeDescriptionContent = `<!-- --start-- ${routePrecisePath} -->

# Route Description 
${options.descriptionText || "No description Text Provided"}

## Route Path: 
${routePrecisePath}

## Route Method:
${options.method}


${
    options.additionalTypes
        ? `## Defined Types: 
\`\`\`ts
${options.additionalTypes}
\`\`\``
        : ""
}

## route Request Headers type definition:
\`\`\`ts
type RequestHeader = ${options.requestHeadersTypeString || "any"}
\`\`\`

## route Request Params type definition:
\`\`\`ts
type RequestQueryParams = ${options.requestParamsTypeString || "any"}
\`\`\`

## route Request Body type definition:
\`\`\`ts
type RequestBody = ${options.requestBodyTypeString || "any"}
\`\`\`

## Response Content Mimetype: 
${options.responseContentType}

## Response Content Type Definition: 
\`\`\`ts
type Response = ${options.responseBodyTypeString || "any"}
\`\`\`



<!-- --end-- ${routePrecisePath} -->`;

            if (!descriptionFileName) {
                fs.writeFileSync(descriptionFileFullPath, routeDescriptionContent);
            } else {
                const content = fs.readFileSync(descriptionFileFullPath, "utf-8");

                if (!content.includes(routePrecisePath)) {
                    fs.writeFileSync(descriptionFileFullPath, content + "\n\n" + routeDescriptionContent);
                } else {
                    fs.writeFileSync(
                        descriptionFileFullPath,
                        content.replace(
                            RegExp(
                                `\\<\\!-- --start-- ${routePrecisePath.replaceAll("/", "\\/")} --\\>(.|\n)*?\\<\\!-- --end-- ${routePrecisePath.replaceAll("/", "\\/")} --\\>`,
                            ),
                            routeDescriptionContent,
                        ),
                    );
                }
            }

            options.fullRoutePath = routePrecisePath;
            options.descriptionFileFullPath = path.join(routePrecisePath, "/describe");

            if (descriptionsMap[options.fullRoutePath]) {
                console.error(
                    "Route Descriptor Already Registered",
                    "\nNew Registeration:",
                    options,
                    "\nOld Registeration:",
                    descriptionsMap[options.fullRoutePath],
                );
                throw new Error();
            }
            options.fileUrl = options.fullRoutePath;
            descriptionsMap[options.fullRoutePath] = options;
        } catch (error: any) {
            console.error(error);
            console.error("CRITICAL: Invalid Route Descriptor", options);
            process.exit(-1);
        }
    },
    {
        lockName: "settingUpRouteDescriptions",
    },
);

export const describeRoute = describe;
