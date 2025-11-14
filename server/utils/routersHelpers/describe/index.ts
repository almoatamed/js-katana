import { descriptionSuffixRegx, routerSuffixRegx } from "../../routersHelpers/matchers.js";
import fs from "fs";
import mime from "mime-types";
import path from "path";
import ts from "typescript";
import url from "url";
import { getDescriptionPreExtensionSuffix, getRouterDirectory, getRouteSuffix } from "../../loadConfig/index.js";

export type DescriptionProps = {
    fileUrl: string;
    path?: string;
    fullRoutePath?: string;
    requiresAuth?: boolean;
    descriptionText?: string;
    method: "ALL" | "GET" | "PUT" | "POST" | "DELETE" | "PATCH";
    requestParamsTypeString?: string;
    requestBodyTypeString?: string;
    requestHeadersTypeString?: string;
    responseContentType?: string;
    additionalTypes?: string;
    responseBodyTypeString?: string;
    descriptionFileFullPath?: string;
};
export type RouteDescriptionProps = DescriptionProps;
export let routesDescriptionMap = {} as {
    [key: string]: DescriptionProps;
};
export const clearRoutesDescriptionMap = () => {
    routesDescriptionMap = {};
};

const fileFullPathToRoute = new Map<string, string>();

export const removeFilesFromRoutesDescriptionMap = (filesFullPaths: string[]) => {
    for (const f of filesFullPaths) {
        const event = fileFullPathToRoute.get(f);
        if (event) {
            (routesDescriptionMap as any)[event] = undefined;
        }
        fileFullPathToRoute.delete(f);
    }
    routesDescriptionMap = Object.fromEntries(
        Object.entries(routesDescriptionMap).filter(([_, description]) => {
            return !!description;
        })
    );
};
const routerDirectory = await getRouterDirectory();

const checkType = (typeString: string) => {
    const sourceCode = `type TempType = ${typeString};`;
    // oxlint-disable-next-line no-eval
    eval(ts.transpile(sourceCode));
};

const descriptionPreExtensionSuffix = await getDescriptionPreExtensionSuffix();
const routerSuffix = await getRouteSuffix();

export const describe = (options: DescriptionProps) => {
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
                'Invalid Route Name, a route file should end with "' + routerSuffix + '" provided is: ',
                routeFileName
            );
            throw new Error();
        }

        const routeFileNameWithoutExtension = routeFileName.slice(0, routeFileName.indexOf(routeSuffixMatch[0]));

        const routePrecisePath = path.join(
            routeFileNameWithoutExtension == "index"
                ? routeRelativeDirectory
                : path.join(routeRelativeDirectory, routeFileNameWithoutExtension),
            options.path || ""
        );
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
                if (!content.includes(`<!-- --start-- ${routePrecisePath} -->`)) {
                    fs.writeFileSync(descriptionFileFullPath, content + `\n\n` + routeDescriptionContent);
                } else {
                    fs.writeFileSync(
                        descriptionFileFullPath,
                        content.replace(
                            RegExp(
                                `\\<\\!-- --start-- ${routePrecisePath.replaceAll(
                                    "/",
                                    "\\/"
                                )} --\\>(.|\n)*?\\<\\!-- --end-- ${routePrecisePath.replaceAll("/", "\\/")} --\\>`
                            ),
                            routeDescriptionContent
                        )
                    );
                }
            }
        }

        options.fullRoutePath = routePrecisePath;
        options.descriptionFileFullPath = path.join(routePrecisePath, "/describe");

        // options.fileUrl = options.fullRoutePath;
        fileFullPathToRoute.set(routePath, options.fullRoutePath);
        if (routesDescriptionMap[options.fullRoutePath]) {
            console.warn(
                "Route Descriptor Already Registered: overriding previous registration.",
                "\nNew Registration:",
                options,
                "\nOld Registration:",
                routesDescriptionMap[options.fullRoutePath]
            );
            routesDescriptionMap[options.fullRoutePath] = {
                ...routesDescriptionMap[options.fullRoutePath],
                ...options,
            };
        } else {
            routesDescriptionMap[options.fullRoutePath] = options;
        }
    } catch (error: any) {
        console.error(error);
        console.error("CRITICAL: Invalid Route Descriptor", options);
    }
};

export const describeRoute = describe;
