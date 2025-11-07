import {
    ChannelHandlerBeforeMounted,
    ChannelHandlerBuilder,
    ChannelHandlerMounted,
    handlers,
} from "../channelsBuilder/index.js";
import {
    descriptionSuffixRegx,
    directoryAliasSuffixRegx,
    middlewareSuffixRegx,
    routerSuffixRegx,
} from "../routersHelpers/matchers.js";
import { createLogger } from "kt-logger";
import {
    aliasSymbol,
    createRequestError,
    extractRequestError,
    HandlerContext,
    RouterAlias,
    routerSymbol,
    throwRequestError,
    throwUnauthorizedError,
    type CreateHandler,
    type Handler,
    type Middleware,
    type Route,
} from "../router/index.js";
import { getAllDescriptionsSecret, getRouterDirectory, getTypesPlacementDir, isDev } from "../loadConfig/index.js";
import { readFile } from "fs/promises";
import ts from "typescript";
import path from "path";
import fs from "fs";
import { describeRoute, routesDescriptionMap } from "../routersHelpers/describe/index.js";
import { pathToFileURL } from "url";
import { channelsDescriptionsMap, describeChannel } from "../channelsHelpers/describe/listener/index.js";
import cluster from "cluster";
import { renderMdDescriptionFile } from "../renderDescriptionFile/index.js";
import { describeEvent, descriptionsMap } from "../channelsHelpers/describe/emitter/index.js";

const log = await createLogger({
    color: "blue",
    logLevel: "Info",
    name: "routerBuilder",
    worker: false,
});
type RouteRegistry = {
    [key: string]: Route<any, any, any, any, any>;
};

export let routesRegistryMap: RouteRegistry = {};

const aliases = [] as any;

const routesFilesMap: {
    [key: string]: string;
} = {};

export async function getMiddlewaresArray(routerDirectory: string): Promise<Handler<any, any, any, any, any>[]> {
    const content = fs.readdirSync(routerDirectory);
    const middlewares = (
        await Promise.all(
            content
                .filter((f) => {
                    const fileStats = fs.statSync(path.join(routerDirectory, f));
                    return fileStats.isFile() && !!f.match(middlewareSuffixRegx);
                })
                .map(async (f) => {
                    const fullPath = path.join(routerDirectory, f);
                    const middleware: Handler<any, any, any, any, any> = (await import(fullPath)).default;
                    if (typeof middleware != "function") {
                        console.error(
                            "Failed to load middleware on ",
                            fullPath,
                            "expected a Handler got",
                            typeof middlewares
                        );
                        process.exit(1);
                    }
                    return middleware;
                })
        )
    ).filter((e) => !!e);
    return middlewares;
}
const defaultRoutesDirectory = await getRouterDirectory();
export default async function buildRouter(
    providedMiddlewares: Middleware<any, any, any, any, any>[] = [],
    routerDirectory = defaultRoutesDirectory,
    root = true,
    fullPrefix = "/"
) {
    if (root) {
        routesRegistryMap = {};
    }
    const content = fs.readdirSync(routerDirectory);

    providedMiddlewares = [...providedMiddlewares, ...(await getMiddlewaresArray(routerDirectory))];

    for (const item of content) {
        const itemStat = fs.statSync(path.join(routerDirectory, item));

        if (itemStat.isDirectory()) {
            await buildRouter(
                providedMiddlewares,
                path.join(routerDirectory, item),
                false,
                path.join(fullPrefix, item)
            );
        } else {
            const routerMatch = item.match(routerSuffixRegx);
            if (routerMatch) {
                const routerName = item.slice(0, item.indexOf(routerMatch[0]));
                const routeFullPath = path.join(routerDirectory, item);
                const routerInstance: ReturnType<typeof CreateHandler> = (await import(routeFullPath)).default;

                if (routerName == "index") {
                    routesFilesMap[routeFullPath] = fullPrefix;
                } else {
                    routesFilesMap[routeFullPath] = path.join(fullPrefix, routerName);
                }

                if (!routerInstance) {
                    continue;
                }

                if (routerInstance?.__symbol != routerSymbol) {
                    console.error("Expecting Router Handler Got", routerInstance);
                    process.exit(1);
                }

                routerInstance.externalMiddlewares = [...providedMiddlewares];

                if (routerName == "index") {
                    routesRegistryMap[fullPrefix] = routerInstance;

                    const routerDescriptionRegx = RegExp(
                        `${routerName}${descriptionSuffixRegx.toString().slice(1, -1)}`
                    );
                    const routerDescriptionFile = content.find((el) => !!el.match(routerDescriptionRegx));
                    if (routerDescriptionFile) {
                        routesRegistryMap[path.join(fullPrefix, "/describe")] = {
                            __symbol: routerSymbol,
                            serveVia: ["Http"],
                            externalMiddlewares: [],
                            handler: async (context) => {
                                const fullPath = path.join(routerDirectory, routerDescriptionFile);
                                if (fullPath.endsWith(".md")) {
                                    const rendered = await renderMdDescriptionFile(path.join(fullPrefix), fullPath);
                                    return context.respond.html(rendered);
                                }
                                return context.respond.file(fullPath);
                            },
                            method: "GET",
                            middleWares: [],
                        };
                    }
                } else {
                    const routePath = path.join(fullPrefix, routerName);

                    routesRegistryMap[routePath] = routerInstance;

                    const routerDescriptionRegx = RegExp(
                        `${routerName}${descriptionSuffixRegx.toString().slice(1, -1)}`
                    );
                    const routerDescriptionFile = content.filter((el) => !!el.match(routerDescriptionRegx))[0];
                    if (routerDescriptionFile) {
                        routesRegistryMap[path.join(fullPrefix, routerName, "/describe")] = {
                            __symbol: routerSymbol,
                            externalMiddlewares: [],
                            handler: async (context) => {
                                const fullPath = path.join(routerDirectory, routerDescriptionFile);
                                if (fullPath.endsWith(".md")) {
                                    return context.respond.html(
                                        await renderMdDescriptionFile(path.join(fullPrefix, routerName), fullPath)
                                    );
                                }

                                return context.respond.file(fullPath);
                            },
                            serveVia: ["Http"],
                            method: "GET",
                            middleWares: [],
                        };
                    }
                }
            } else {
                const directoryAliasMatch = item.match(directoryAliasSuffixRegx);
                if (directoryAliasMatch) {
                    const routerName = item.slice(0, item.indexOf(directoryAliasMatch[0]));
                    const fullRoute = path.join(fullPrefix, routerName);
                    const fullAliasPath = path.join(routerDirectory, item);

                    const routerAlias: RouterAlias = (await import(fullAliasPath)).default;
                    if (routerAlias.__symbol != aliasSymbol) {
                        log.error("Expected router alias at", fullAliasPath, " but got", routerAlias);
                    }

                    const middlewares = [...providedMiddlewares];

                    // if (!routerAlias.path.startsWith("/")) {
                    //     routerAlias.path = "/" + routerAlias;
                    // }

                    aliases.push(async () => {
                        const matchingRoutes = Object.fromEntries(
                            Object.entries(routesRegistryMap)
                                .filter(([path, _]) => {
                                    return path.startsWith(routerAlias.path);
                                })
                                .map(([path, route]) => {
                                    route = { ...route };
                                    path = path.replace(routerAlias.path, fullRoute);
                                    if (routerAlias.includeOriginalMIddlewares) {
                                        route.externalMiddlewares = [...middlewares, ...route.externalMiddlewares];
                                    } else {
                                        route.externalMiddlewares = [...middlewares];
                                    }
                                    return [path, route];
                                })
                        );

                        for (const routePath in matchingRoutes) {
                            routesRegistryMap[routePath] = matchingRoutes[routePath];
                        }
                    });
                }
            }
        }
    }

    if (root) {
        await Promise.all(aliases.map((f) => f()));
        await processRouterForChannels();
        await maybeProcessRoutesForTypes();
        routesRegistryMap[path.join(fullPrefix, "/__describe-json")] = {
            __symbol: routerSymbol,
            externalMiddlewares: [],
            handler: async (context) => {
                const fullPath = path.join(await getTypesPlacementDir(), "apiTypes.json");
                if (!fs.existsSync(fullPath)) {
                    throwRequestError(404, [
                        {
                            error: "API Types description not found",
                        },
                    ]);
                }
                return context.respond.file(fullPath);
            },
            method: "GET",
            middleWares: [
                async (context) => {
                    if (await isDev()) {
                        return;
                    }
                    const secret = await getAllDescriptionsSecret();
                    if (!secret) {
                        return;
                    }
                    const authorizationHeader = context.headers["authorization"] || context.headers["Authorization"];
                    if (authorizationHeader !== `Secret ${secret}`) {
                        throwUnauthorizedError("Unauthorized to access descriptions");
                    }
                },
            ],
            serveVia: ["Http"],
        };

        log("finished Building Router:", Object.keys(routesRegistryMap));
    }
}

export async function getChannelMiddlewaresArray(currentChannelsDirectory: string): Promise<
    {
        channelMiddleware?: ChannelHandlerBuilder<any, any>;
        channelMounted?: ChannelHandlerMounted;
        channelBeforeMounted?: ChannelHandlerBeforeMounted;
    }[]
> {
    const content = fs.readdirSync(currentChannelsDirectory);
    const middlewares = await Promise.all(
        content
            .filter((f) => {
                const fileStats = fs.statSync(path.join(currentChannelsDirectory, f));
                return fileStats.isFile() && !!f.match(middlewareSuffixRegx);
            })
            .map(async (f) => {
                let fullPath = path.join(currentChannelsDirectory, f);
                const importedResult = await import(fullPath);
                return importedResult;
            })
    );
    return middlewares;
}

async function buildChannelling(
    currentChannelsDirectory = defaultRoutesDirectory,
    root = true,
    fullPrefix = "/",
    providedBeforeMountedMiddlewares: {
        middleware: ChannelHandlerBeforeMounted[];
        path: string;
    }[] = [],
    providedMiddlewares: {
        middleware: ChannelHandlerBuilder<any, any>[];
        path: string;
    }[] = [],
    providedMountedMiddlewares: {
        middleware: ChannelHandlerMounted[];
        path: string;
    }[] = []
) {
    if (root) {
        log("Building Channels", currentChannelsDirectory);
    }

    const content = fs.readdirSync(currentChannelsDirectory);

    const beforeMountedMiddlewares = [...(providedBeforeMountedMiddlewares || [])];
    const middlewares = [...(providedMiddlewares || [])];
    const mountedMiddlewares = [...(providedMountedMiddlewares || [])];

    const loadedMiddlewares = await getChannelMiddlewaresArray(currentChannelsDirectory);

    for (const middleware of loadedMiddlewares || []) {
        if (middleware.channelBeforeMounted) {
            const foundBeforeMountedMiddleware = beforeMountedMiddlewares.find((pbmm) => pbmm.path == fullPrefix);
            if (foundBeforeMountedMiddleware) {
                foundBeforeMountedMiddleware.middleware.push(middleware.channelBeforeMounted);
            } else {
                beforeMountedMiddlewares.push({
                    middleware: [middleware.channelBeforeMounted],
                    path: fullPrefix,
                });
            }
        }

        if (middleware.channelMiddleware) {
            const foundMiddleware = middlewares.find((pm) => pm.path == fullPrefix);
            if (foundMiddleware) {
                foundMiddleware.middleware.push(middleware.channelMiddleware);
            } else {
                middlewares.push({
                    middleware: [middleware.channelMiddleware],
                    path: fullPrefix,
                });
            }
        }

        if (middleware.channelMounted) {
            const foundMountedMiddleware = mountedMiddlewares.find((pbmm) => pbmm.path == fullPrefix);
            if (foundMountedMiddleware) {
                foundMountedMiddleware.middleware.push(middleware.channelMounted);
            } else {
                mountedMiddlewares.push({
                    middleware: [middleware.channelMounted],
                    path: fullPrefix,
                });
            }
        }
    }

    for (const item of content) {
        const itemFullPath = path.join(currentChannelsDirectory, item);
        const itemStat = fs.statSync(itemFullPath);

        if (itemStat.isDirectory()) {
            await buildChannelling(
                itemFullPath,
                false,
                path.join(fullPrefix, item),
                beforeMountedMiddlewares,
                middlewares,
                mountedMiddlewares
            );
        } else {
            const channelMatch = item.match(routerSuffixRegx);
            if (channelMatch) {
                const routerName = item.slice(0, item.indexOf(channelMatch[0]));
                if (routerName == "index") {
                    const handlerPath = itemFullPath;
                    const { handler, mounted, beforeMounted } = await import(handlerPath);
                    if (!handler) {
                        continue;
                    }

                    handlers.push({
                        path: fullPrefix,

                        beforeMounted,
                        handler,
                        mounted,

                        middlewares: [...middlewares],
                        mountedMiddlewares: [...mountedMiddlewares],
                        beforeMountedMiddlewares: [...beforeMountedMiddlewares],
                    });
                } else {
                    const handlerPath = itemFullPath;
                    const { handler, mounted, beforeMounted } = await import(handlerPath);

                    const channelPath = path.join(fullPrefix, routerName);
                    handlers.push({
                        path: channelPath,

                        mounted,
                        handler,
                        beforeMounted,

                        middlewares: [...middlewares],
                        mountedMiddlewares: [...mountedMiddlewares],
                        beforeMountedMiddlewares: [...beforeMountedMiddlewares],
                    });
                }
            } else {
                const directoryAliasMatch = item.match(directoryAliasSuffixRegx);
                if (directoryAliasMatch) {
                    aliases.push(async () => {
                        const routerAlias: RouterAlias = (await import(itemFullPath)).default;
                        const routerName = item.slice(0, item.indexOf(directoryAliasMatch[0]));
                        const aliases = handlers
                            .filter((h) => {
                                return h.path.startsWith(routerAlias.path);
                            })
                            .map((h) => {
                                const newHandler = { ...h };
                                newHandler.path = newHandler.path.replace(
                                    RegExp(`^${routerAlias.path.replaceAll("/", "\\/")}`),
                                    path.join(fullPrefix, routerName)
                                );
                                if (routerAlias.includeOriginalMIddlewares) {
                                    newHandler.beforeMountedMiddlewares = [
                                        ...beforeMountedMiddlewares,
                                        ...(newHandler.beforeMountedMiddlewares || []),
                                    ];
                                    newHandler.middlewares = [...middlewares, ...(newHandler.middlewares || [])];
                                    newHandler.mountedMiddlewares = [
                                        ...mountedMiddlewares,
                                        ...(newHandler.mountedMiddlewares || []),
                                    ];
                                } else {
                                    newHandler.beforeMountedMiddlewares = [...beforeMountedMiddlewares];
                                    newHandler.middlewares = [...middlewares];
                                    newHandler.mountedMiddlewares = [...mountedMiddlewares];
                                }
                                return newHandler;
                            });
                        handlers.push(...aliases);
                    });
                }
            }
        }
    }

    if (root) {
        await Promise.all(aliases.map((f) => f()));
        log("finished building channels", currentChannelsDirectory);
    }
}

const loadCompatibleRoutesIntoChannels = async () => {
    Object.entries(routesRegistryMap)
        .filter(([_path, route]) => {
            return route.serveVia.includes("Socket");
        })
        .map(([path, route]) => {
            handlers.push({
                beforeMountedMiddlewares: [],
                middlewares: [],
                mountedMiddlewares: [],
                path: path,
                beforeMounted: undefined,
                handler: (_socket) => {
                    return [
                        async (body: any, cb, _ev) => {
                            if (!cb) {
                                return;
                            }

                            let responded = false;
                            try {
                                let statusCode = 200;

                                const query = body?.__query || {};
                                const params = body?.__params || {};
                                const headers = body?.__headers || {};

                                const context: HandlerContext<any, any, any, any> = {
                                    locale: {},
                                    respond: {
                                        async file(fullPath) {
                                            const data = await readFile(fullPath);
                                            cb?.(data);
                                            responded = true;
                                            return {
                                                path: fullPath,
                                            };
                                        },
                                        html: (text) => {
                                            cb?.(text);
                                            responded = true;

                                            return text;
                                        },
                                        text: (text) => {
                                            cb?.(text);
                                            responded = true;

                                            return text;
                                        },
                                        json: (data: any) => {
                                            if (typeof data == "object") {
                                                data.__status = statusCode;
                                            }
                                            cb?.(data);
                                            responded = true;
                                            return data;
                                        },
                                    },
                                    body,
                                    headers,
                                    params,
                                    query,
                                    setStatus(_statusCode) {
                                        statusCode = _statusCode;
                                        return context;
                                    },
                                };

                                for (const middleware of route.middleWares) {
                                    await middleware(context, body, query, params, headers);
                                }

                                await route.handler(context, body, query, params, headers);
                                if (!responded) {
                                    console.warn("You Did not respond properly to the request on", route.method, path);
                                    cb?.({
                                        __status: 200,
                                        msg: "OK",
                                    });
                                }
                            } catch (error) {
                                if (responded) {
                                    return;
                                }
                                const requestError = extractRequestError(error);
                                if (requestError) {
                                    cb(requestError);
                                    return;
                                }
                                cb(
                                    createRequestError(500, [
                                        {
                                            error: "Unknown server error",
                                            data: error,
                                        },
                                    ])
                                );
                            }
                        },
                    ];
                },
                mounted: undefined,
            });
        });
};

async function processRouterForChannels() {
    await loadCompatibleRoutesIntoChannels();
    await buildChannelling();
}

const createTypeManager = async (routesFilesMap: { [key: string]: string }) => {
    // Basic compiler options
    const options = {
        target: ts.ScriptTarget.Latest,
        module: ts.ModuleKind.CommonJS,
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
    };

    // Create a CompilerHost that serves our in-memory files
    const host = ts.createCompilerHost(options);
    host.getSourceFile = (fileName: string, languageVersion: ts.ScriptTarget | ts.CreateSourceFileOptions) => {
        // fallback to default behaviour (lib.d.ts)
        return ts.createSourceFile(fileName, ts.sys.readFile(fileName) || "", languageVersion);
    };

    host.readFile = (fileName) => {
        return ts.sys.readFile(fileName);
    };
    host.fileExists = (fileName) => {
        return ts.sys.fileExists(fileName);
    };

    // Create program
    const program = ts.createProgram(Object.keys(routesFilesMap), options, host);
    const checker = program.getTypeChecker();
    return {
        checker,
        host,
        program,
    };
};

/* --- Helpers for expanding and stringifying types --- */
const TypeFlags = ts.TypeFlags;
const ObjectFlags = ts.ObjectFlags;

function isTypeReference(t: any): t is ts.TypeReference {
    return !!(t.flags & TypeFlags.Object) && !!(t.objectFlags & ObjectFlags.Reference);
}

function expandAliasIfNeeded(checker: ts.TypeChecker, type: ts.Type) {
    if (!type) return type;
    if (type.aliasSymbol) {
        try {
            const declared = checker.getDeclaredTypeOfSymbol(type.aliasSymbol);
            if (declared) return declared;
        } catch (e) {
            console.error(e);
        }
    }
    return type;
}

function stringify(checker: ts.TypeChecker, type: ts.Type, depth = 0, parentsNames: string[] = []): string {
    if (!type) return "any";
    const typeName = checker.typeToString(type);
    if (
        depth > 20 ||
        (![
            "Array",
            "object",
            "Promise",
            "boolean",
            "undefined",
            "null",
            "number",
            "String",
            "string",
            "Number",
            "Boolean",
            "Object",
            "Uint8Array",
            "Buffer",
            "Blob",
            "arrayBuffer",
        ].includes(typeName) &&
            parentsNames.some((p) => p === typeName))
    )
        return typeName;

    const extendedParents = [...parentsNames, typeName];

    // expand alias
    if (type.aliasSymbol) {
        const declared = expandAliasIfNeeded(checker, type);
        if (declared !== type) return stringify(checker, declared, depth + 1, extendedParents);
    }

    // unions / intersections
    if (type.isUnion && type.isUnion()) {
        return type.types.map((t: any) => stringify(checker, t, depth + 1, extendedParents)).join(" | ");
    }
    if (type.isIntersection && type.isIntersection()) {
        return type.types.map((t: any) => stringify(checker, t, depth + 1, extendedParents)).join(" & ");
    }

    // type references (generics)
    if (isTypeReference(type)) {
        const typeRef = type;
        const target = typeRef.target || typeRef;
        const typeArgs = checker.getTypeArguments(typeRef) || [];
        const targetSymbol = (target && target.symbol) || (type && type.symbol);
        const targetName = targetSymbol ? targetSymbol.getName() : checker.typeToString(target);

        // common special-cases
        if (targetName === "Array" && typeArgs.length === 1) {
            return `${stringify(checker, typeArgs[0], depth + 1, extendedParents)}[]`;
        }
        if (targetName === "Promise" && typeArgs.length === 1) {
            return `Promise<${stringify(checker, typeArgs[0], depth + 1, extendedParents)}>`;
        }
        if (typeArgs.length) {
            return `${targetName}<${typeArgs
                .map((a) => stringify(checker, a, depth + 1, extendedParents))
                .join(", ")}>`;
        }
        return targetName;
    }

    // object types - expand members
    if (type.flags & TypeFlags.Object) {
        const objFlags = (type as any).objectFlags || 0;
        if (objFlags & (ObjectFlags.Anonymous | ObjectFlags.Class | ObjectFlags.Interface)) {
            const props = checker.getPropertiesOfType(type);
            if (!props.length) return checker.typeToString(type);
            const members = props.map((p) => {
                const decl = p.valueDeclaration || (p.declarations && p.declarations[0]);
                if (!decl) {
                    return `${p.getName()}: any`;
                }
                const pType = checker.getTypeOfSymbolAtLocation(p, decl);
                const optional = p.flags & ts.SymbolFlags.Optional ? "?" : "";
                return `${p.getName()}${optional}: ${stringify(checker, pType, depth + 1, extendedParents)}`;
            });
            return `{\n  ${members.join(";\n  ")}\n}`;
        }
        return checker.typeToString(type);
    }

    // literal types
    if (type.flags & (TypeFlags.StringLiteral | TypeFlags.NumberLiteral | TypeFlags.BooleanLiteral)) {
        return checker.typeToString(type);
    }

    // fallback
    return checker.typeToString(type);
}

const useContextToProcessRouteForTypes = async (
    routeFileFullPath: string,
    exportExpr: ts.Expression,
    context: {
        checker: ts.TypeChecker;
        host: ts.CompilerHost;
        program: ts.Program;
    }
) => {
    try {
        const { checker } = context;

        const exportedType = checker.getTypeAtLocation(exportExpr);
        const handlerProp = checker.getPropertyOfType(exportedType, "handler");
        if (!handlerProp) throw new Error("handler property not found on exported type");
        const handlerType = checker.getTypeOfSymbolAtLocation(handlerProp, exportExpr);
        const sigs = checker.getSignaturesOfType(handlerType, ts.SignatureKind.Call);
        if (!sigs || !sigs.length) throw new Error("handler does not have a call signature");
        const sig = sigs[0];

        const paramSymbols = sig.getParameters();
        function getParamTypeByIndex(i: number) {
            if (!paramSymbols[i]) return null;
            const psym = paramSymbols[i];
            const decl = psym.valueDeclaration || (psym.declarations && psym.declarations[0]) || exportExpr;
            return checker.getTypeOfSymbolAtLocation(psym, decl);
        }

        const bodyType = getParamTypeByIndex(1);
        const queryType = getParamTypeByIndex(2);
        const paramsType = getParamTypeByIndex(3);
        const headersType = getParamTypeByIndex(4);
        const returnType = checker.getReturnTypeOfSignature(sig);

        // Print body / query / params / headers with fallback if missing
        const bodyTypeString = bodyType ? stringify(context.checker, bodyType, 0) : "unknown";
        const queryTypeString = queryType ? stringify(context.checker, queryType, 0) : "unknown";
        const paramsTypeString = paramsType ? stringify(context.checker, paramsType, 0) : "unknown";
        const headersTypeString = headersType ? stringify(context.checker, headersType, 0) : "unknown";
        const returnTypeString = returnType ? stringify(context.checker, returnType, 0) : "unknown";

        return {
            bodyTypeString,
            queryTypeString,
            paramsTypeString,
            headersTypeString,
            returnTypeString,
        };
    } catch (error) {
        console.error(routeFileFullPath, error);
        return null;
    }
};

const useContextToProcessChannelsForTypes = async (
    routeFileFullPath: string,
    exportExpr: ts.Expression,
    context: {
        checker: ts.TypeChecker;
        host: ts.CompilerHost;
        program: ts.Program;
    }
): Promise<null | { bodyTypeString: string; expectResponse: string }> => {
    const { checker, program } = context;

    try {
        const sf = program.getSourceFile(routeFileFullPath);
        if (!sf) return null;

        // Helper to print short snippets for diagnostics
        const snippetOf = (node?: ts.Node) => {
            try {
                if (!node) return "<no-node>";
                const src = node.getSourceFile().getFullText();
                const start = Math.max(0, node.getStart() - 20);
                const end = Math.min(src.length, node.getEnd() + 20);
                return src.slice(start, end).replace(/\r?\n/g, " ");
            } catch {
                return "<snippet-error>";
            }
        };

        // Resolve exportedNode (declaration) similar to prior logic
        let exportedNode: ts.Node | undefined = undefined;
        if (ts.isIdentifier(exportExpr)) {
            const sym = checker.getSymbolAtLocation(exportExpr);
            if (sym && sym.declarations && sym.declarations.length) {
                exportedNode = sym.declarations[0];
            }
        } else {
            exportedNode = exportExpr;
        }

        // Attempt to find the callback Node (the function passed to defineChannelHandler)
        let callbackNode: ts.Expression | null = null;

        // 1) If exportedNode is a variable declaration with CallExpression initializer, inspect its first arg
        if (
            exportedNode &&
            ts.isVariableDeclaration(exportedNode) &&
            exportedNode.initializer &&
            ts.isCallExpression(exportedNode.initializer)
        ) {
            const call = exportedNode.initializer;
            if (call.arguments && call.arguments.length >= 1) {
                callbackNode = call.arguments[0];
            }
        }

        // 2) If export assignment that is a call expression -> take first arg
        if (!callbackNode && ts.isExportAssignment(exportedNode!) && ts.isCallExpression(exportedNode.expression)) {
            const call = exportedNode.expression;
            if (call.arguments && call.arguments.length >= 1) callbackNode = call.arguments[0];
        }

        // 3) If callbackNode still not found: if exportExpr is identifier, scan file for variable statement that exports 'handler' (existing logic)
        if (!callbackNode && ts.isIdentifier(exportExpr)) {
            const name = exportExpr.text;
            ts.forEachChild(sf, (node) => {
                if (callbackNode) return;
                if (ts.isVariableStatement(node)) {
                    for (const decl of node.declarationList.declarations) {
                        if (
                            ts.isIdentifier(decl.name) &&
                            decl.name.text === name &&
                            decl.initializer &&
                            ts.isCallExpression(decl.initializer)
                        ) {
                            const call = decl.initializer;
                            if (call.arguments && call.arguments.length >= 1) {
                                callbackNode = call.arguments[0];
                                return;
                            }
                        }
                    }
                }
            });
        }

        // 4) If still not found: scan the file for any callExpression to 'defineChannelHandler' and take its first arg
        if (!callbackNode) {
            const findCall = (n: ts.Node) => {
                if (callbackNode) return;
                if (ts.isCallExpression(n)) {
                    let fnName = "";
                    if (ts.isIdentifier(n.expression)) fnName = n.expression.text;
                    else if (ts.isPropertyAccessExpression(n.expression) && ts.isIdentifier(n.expression.name))
                        fnName = n.expression.name.text;
                    if (fnName === "defineChannelHandler" && n.arguments && n.arguments.length > 0) {
                        callbackNode = n.arguments[0];
                        return;
                    }
                }
                ts.forEachChild(n, findCall);
            };
            findCall(sf);
        }

        // If callbackNode is an identifier, try to resolve it to its declaration (function/var init)
        if (callbackNode && ts.isIdentifier(callbackNode)) {
            const sym = checker.getSymbolAtLocation(callbackNode);
            if (sym && sym.declarations && sym.declarations.length) {
                for (const decl of sym.declarations) {
                    if (ts.isVariableDeclaration(decl) && decl.initializer) {
                        callbackNode = decl.initializer as ts.Expression;
                        break;
                    }
                    if (ts.isFunctionDeclaration(decl)) {
                        callbackNode = decl as unknown as ts.Expression;
                        break;
                    }
                }
            }
        }

        // Now, try to obtain a call signature for the callback (multiple fallbacks)
        let callbackSig: ts.Signature | undefined;

        // 1) If callbackNode is a function-like AST node, use getSignatureFromDeclaration
        if (
            callbackNode &&
            (ts.isFunctionExpression(callbackNode) ||
                ts.isArrowFunction(callbackNode) ||
                ts.isFunctionDeclaration(callbackNode))
        ) {
            callbackSig = checker.getSignatureFromDeclaration(callbackNode as ts.SignatureDeclaration) || undefined;
        }

        // 2) If still no signature and callbackNode exists, try type-based signatures
        if (!callbackSig && callbackNode) {
            try {
                const callbackType = checker.getTypeAtLocation(callbackNode);
                let sigs = checker.getSignaturesOfType(callbackType, ts.SignatureKind.Call);
                if ((!sigs || !sigs.length) && typeof (callbackType as any)?.getCallSignatures === "function") {
                    const cs = (callbackType as any).getCallSignatures();
                    if (cs && cs.length) sigs = cs;
                }
                if (sigs && sigs.length) callbackSig = sigs[0];
            } catch {
                // ignore
            }
        }

        // 3) If still none, and exportExpr yields a builder type, try to extract definition callback signature from exported type:
        if (!callbackSig) {
            try {
                const exportedType = checker.getTypeAtLocation(exportExpr);
                const builderSigs = checker.getSignaturesOfType(exportedType, ts.SignatureKind.Call) || [];
                if (builderSigs && builderSigs.length) {
                    // The builder signature's first parameter should be the 'definition' function type. Extract its call sigs.
                    const builderSig = builderSigs[0];
                    if (builderSig.getParameters().length > 0) {
                        const defParam = builderSig.getParameters()[0];
                        const defType = checker.getTypeOfSymbolAtLocation(
                            defParam,
                            defParam.valueDeclaration || exportExpr
                        );
                        const defSigs = checker.getSignaturesOfType(defType, ts.SignatureKind.Call);
                        if (defSigs && defSigs.length) {
                            callbackSig = defSigs[0];
                        }
                    }
                }
            } catch {
                // ignore
            }
        }

        // If still no callback signature, give diagnostics and bail out
        if (!callbackSig) {
            console.warn("Could not resolve callback signature for channel handler:", routeFileFullPath);
            console.warn("exportExpr snippet:", snippetOf(exportExpr));
            console.warn(
                "callbackNode kind/snippet:",
                callbackNode ? ts.SyntaxKind[callbackNode.kind] + " / " + snippetOf(callbackNode) : "<none>"
            );
            return null;
        }

        // Get the return type of the callback signature - should have a 'handler' property
        const callbackReturnType = checker.getReturnTypeOfSignature(callbackSig);

        // find 'handler' property on return type
        const handlerProp = checker.getPropertyOfType(callbackReturnType, "handler");
        if (!handlerProp) {
            // sometimes the callback returns an array or other shape; as a fallback, inspect the callbackReturnType directly for call signatures (rare)
            console.warn("Callback return type has no 'handler' property for", routeFileFullPath);
            console.warn("callbackReturnType:", checker.typeToString(callbackReturnType));
            return null;
        }

        const handlerDecl = handlerProp.valueDeclaration || (handlerProp.declarations && handlerProp.declarations[0]);
        const handlerType = handlerDecl
            ? checker.getTypeOfSymbolAtLocation(handlerProp, handlerDecl)
            : checker.getTypeOfSymbolAtLocation(handlerProp, exportExpr);

        // get call signatures for handler
        let handlerSigs = checker.getSignaturesOfType(handlerType, ts.SignatureKind.Call);
        if (!handlerSigs || !handlerSigs.length) {
            const expanded = expandAliasIfNeeded(checker, handlerType);
            const alt = checker.getSignaturesOfType(expanded, ts.SignatureKind.Call);
            if (alt && alt.length) handlerSigs = alt;
        }

        if (!handlerSigs || !handlerSigs.length) {
            console.warn("Could not get call signatures for handler property on", routeFileFullPath);
            return null;
        }

        const handlerSig = handlerSigs[0];

        // first param => body
        const bodyParamSym = handlerSig.getParameters()[0];
        const bodyType = bodyParamSym
            ? checker.getTypeOfSymbolAtLocation(bodyParamSym, bodyParamSym.valueDeclaration || exportExpr)
            : null;

        // second param => respond
        const respondParamSym = handlerSig.getParameters()[1];
        let expectResponse = "undefined";
        if (respondParamSym) {
            const respondType = checker.getTypeOfSymbolAtLocation(
                respondParamSym,
                respondParamSym.valueDeclaration || exportExpr
            );
            const rSigs = checker.getSignaturesOfType(respondType, ts.SignatureKind.Call);
            if (rSigs && rSigs.length) {
                const rSig = rSigs[0];
                const rFirst = rSig.getParameters()[0];
                if (rFirst) {
                    const rType = checker.getTypeOfSymbolAtLocation(rFirst, rFirst.valueDeclaration || exportExpr);
                    expectResponse = rType ? stringify(checker, rType, 0) : "unknown";
                } else {
                    expectResponse = "void";
                }
            } else {
                // maybe union like Respond<T> | undefined - try union members
                if ((respondType as any).isUnion && (respondType as any).isUnion()) {
                    for (const m of (respondType as any).types) {
                        const msigs = checker.getSignaturesOfType(m, ts.SignatureKind.Call);
                        if (msigs && msigs.length) {
                            const rSig = msigs[0];
                            const rFirst = rSig.getParameters()[0];
                            if (rFirst) {
                                const rType = checker.getTypeOfSymbolAtLocation(
                                    rFirst,
                                    rFirst.valueDeclaration || exportExpr
                                );
                                expectResponse = rType ? stringify(checker, rType, 0) : "unknown";
                                break;
                            } else {
                                expectResponse = "void";
                                break;
                            }
                        }
                    }
                } else {
                    expectResponse = stringify(checker, respondType, 0);
                }
            }
        }

        const bodyTypeString = bodyType ? stringify(checker, bodyType, 0) : "unknown";
        return { bodyTypeString, expectResponse };
    } catch (error) {
        console.error("Error processing channel types for", routeFileFullPath, error);
        return null;
    }
};


const useContextToProcessEventsForTypes = async (
    routeFileFullPath: string,
    callExpression: ts.CallExpression,
    context: {
        checker: ts.TypeChecker;
        host: ts.CompilerHost;
        program: ts.Program;
    }
): Promise<null | { eventName: string; bodyTypeString: string; responseTypeString: string }> => {
    try {
        const { checker } = context;
        // event name: if first arg is a string literal, use it; otherwise fallback to type text
        let eventName = "unknown";
        if (callExpression.arguments && callExpression.arguments.length > 0) {
            const firstArg = callExpression.arguments[0];
            if (ts.isStringLiteral(firstArg) || ts.isNoSubstitutionTemplateLiteral(firstArg)) {
                eventName = firstArg.text;
            } else {
                const t = checker.getTypeAtLocation(firstArg);
                eventName = checker.typeToString(t);
            }
        }

        // Prefer explicit generic type arguments when provided: defineEmittedEvent<Body, Response>(...)
        const typeArgs = callExpression.typeArguments || [];

        let bodyTypeString = "unknown";
        let responseTypeString = "unknown";

        if (typeArgs.length >= 1) {
            try {
                const bodyType = checker.getTypeFromTypeNode(typeArgs[0]);
                bodyTypeString = stringify(checker, bodyType, 0);
            } catch {
                // fallback below
            }
        }

        if (typeArgs.length >= 2) {
            try {
                const responseType = checker.getTypeFromTypeNode(typeArgs[1]);
                responseTypeString = stringify(checker, responseType, 0);
            } catch {
                // fallback below
            }
        }

        // If we didn't get types from generic args, fall back to inspecting the call expression's resulting type
        if (bodyTypeString === "unknown" || responseTypeString === "unknown") {
            const callType = checker.getTypeAtLocation(callExpression); // object-like type returned by the factory
            if (bodyTypeString === "unknown") {
                const bodyProp = checker.getPropertyOfType(callType, "body");
                if (bodyProp) {
                    const decl = bodyProp.valueDeclaration || (bodyProp.declarations && bodyProp.declarations[0]);
                    const t = decl
                        ? checker.getTypeOfSymbolAtLocation(bodyProp, decl)
                        : checker.getTypeOfSymbolAtLocation(bodyProp, callExpression);
                    bodyTypeString = stringify(checker, t, 0);
                }
            }
            if (responseTypeString === "unknown") {
                const respProp =
                    checker.getPropertyOfType(callType, "response") || checker.getPropertyOfType(callType, "response");
                if (respProp) {
                    const decl = respProp.valueDeclaration || (respProp.declarations && respProp.declarations[0]);
                    const t = decl
                        ? checker.getTypeOfSymbolAtLocation(respProp, decl)
                        : checker.getTypeOfSymbolAtLocation(respProp, callExpression);
                    responseTypeString = stringify(checker, t, 0);
                }
            }
        }

        return {
            eventName,
            bodyTypeString,
            responseTypeString,
        };
    } catch (error) {
        console.error(routeFileFullPath, error);
        return null;
    }
};

export const processRoutesForTypes = async (routesFilesMap: { [routeFileFullPath: string]: string }) => {
    const tsContext = await createTypeManager(routesFilesMap);
    const promises = [] as Promise<any>[];
    for (const routeFullPath in routesFilesMap) {
        promises.push(
            (async () => {
                // get the source file we care about
                const sf = tsContext.program.getSourceFile(routeFullPath);
                if (!sf) {
                    return;
                }
                let defaultExportExpr: ts.Expression | null = null;
                let channelExportExpr: ts.Expression | null = null;
                let eventExpressions: ts.CallExpression[] = [];
                for (const stmt of sf.statements) {
                    if (stmt.kind == ts.SyntaxKind.ExpressionStatement) {
                        const exprStmt = stmt as ts.ExpressionStatement;
                        if (ts.isCallExpression(exprStmt.expression)) {
                            const callExpr = exprStmt.expression as ts.CallExpression;
                            if (
                                ts.isIdentifier(callExpr.expression) &&
                                callExpr.expression.text.startsWith("defineEmittedEvent")
                            ) {
                                const sym = tsContext.checker.getSymbolAtLocation(callExpr.expression);
                                if (sym && sym.declarations && sym.declarations.length) {
                                    eventExpressions.push(callExpr);
                                }
                            }
                        }
                    }

                    if (ts.isExportAssignment(stmt) && !stmt.isExportEquals) {
                        defaultExportExpr = stmt.expression;
                    }
                    if (
                        ts.isVariableStatement(stmt) &&
                        stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
                    ) {
                        for (const decl of stmt.declarationList.declarations) {
                            if (ts.isIdentifier(decl.name) && decl.name.text === "handler") {
                                channelExportExpr = decl.initializer || null;
                            }
                        }
                    }
                }

                const promises = [undefined, undefined, undefined] as [
                    (
                        | undefined
                        | Promise<{
                              bodyTypeString: string;
                              queryTypeString: string;
                              paramsTypeString: string;
                              headersTypeString: string;
                              returnTypeString: string;
                          } | null>
                    ),
                    (
                        | undefined
                        | Promise<{
                              bodyTypeString: string;
                              expectResponse: string; // as in `undefined | ((response: ResponseType /* for example User */ )=>void|Promise<void>)`
                          } | null>
                    ),
                    (
                        | undefined
                        | Promise<
                              | {
                                    eventName: string;
                                    bodyTypeString: string;
                                    responseTypeString: string;
                                }[]
                              | null
                          >
                    )
                ];

                if (defaultExportExpr) {
                    promises[0] = useContextToProcessRouteForTypes(routeFullPath, defaultExportExpr, tsContext);
                }

                if (channelExportExpr) {
                    promises[1] = useContextToProcessChannelsForTypes(routeFullPath, channelExportExpr, tsContext);
                } else {
                    console.trace("Could not find export expression for channel handler on: ", routeFullPath);
                }

                if (eventExpressions.length > 0) {
                    promises[2] = (async () => {
                        const results: {
                            eventName: string;
                            bodyTypeString: string;
                            responseTypeString: string;
                        }[] = [];
                        for (const evExpr of eventExpressions) {
                            try {
                                const res = await useContextToProcessEventsForTypes(routeFullPath, evExpr, tsContext);
                                if (res) {
                                    results.push(res);
                                }
                            } catch (err) {
                                console.error("Error processing emitted event for types on", routeFullPath, err);
                            }
                        }
                        return results;
                    })();
                }

                const [routeTypes, channelTypes, eventsTypes] = await Promise.all(promises);
                console.log("Types for Channel", channelTypes);

                const route = routesRegistryMap[routesFilesMap[routeFullPath]];
                if (routeTypes) {
                    describeRoute({
                        fileUrl: pathToFileURL(routeFullPath).toString(),
                        method: route.method,
                        path: "/",
                        requestBodyTypeString: routeTypes.bodyTypeString,
                        requestParamsTypeString: routeTypes.queryTypeString,
                        requestHeadersTypeString: routeTypes.headersTypeString,
                        responseBodyTypeString: routeTypes.returnTypeString,
                    });
                }
                if (channelTypes) {
                    describeChannel({
                        fileUrl: pathToFileURL(routeFullPath).toString(),
                        path: "/",
                        requestBodyTypeString: channelTypes.bodyTypeString,
                        responseBodyTypeString: channelTypes.expectResponse,
                    });
                }
                if (eventsTypes?.length && eventsTypes?.length > 0) {
                    for (const evExpr of eventsTypes) {
                        describeEvent({
                            fileUrl: pathToFileURL(routeFullPath).toString(),
                            event: evExpr.eventName,
                            eventBodyTypeString: evExpr.bodyTypeString,
                            expectedResponseBodyTypeString: evExpr.responseTypeString,
                        });
                    }
                }
            })()
        );
    }
    await Promise.all(promises);
    await storeDescriptions();
};

const storeDescriptions = async () => {
    if (!cluster.isPrimary) {
        return;
    }

    fs.mkdirSync(await getTypesPlacementDir(), { recursive: true });
    fs.writeFileSync(
        path.join(await getTypesPlacementDir(), "apiTypes.json"),
        JSON.stringify(
            {
                routesDescriptions: routesDescriptionMap,
                channelsDescriptions: channelsDescriptionsMap,
                eventsDescriptions: descriptionsMap,
            },
            null,
            4
        )
    );
};

const maybeProcessRoutesForTypes = async () => {
    if (!cluster.isPrimary || !(await isDev())) {
        return;
    }
    await processRoutesForTypes(routesFilesMap);
};
