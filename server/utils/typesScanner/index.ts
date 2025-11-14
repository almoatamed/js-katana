import ts from "typescript";
import { describeRoute, routesDescriptionMap } from "../routersHelpers/describe/index.js";
import { pathToFileURL } from "url";
import { channelsDescriptionsMap, describeChannel } from "../channelsHelpers/describe/listener/index.js";
import { describeEvent, eventsDescriptionMap } from "../channelsHelpers/describe/emitter/index.js";
import { readFile } from "fs/promises";
import { mkdir } from "fs/promises";
import { getDescriptionPreExtensionSuffix, getRouterDirectory, getTypesPlacementDir } from "../loadConfig/index.js";
import { writeFile } from "fs/promises";
import path from "path";
import cluster from "cluster";
import { execSync } from "child_process";
import { routerSuffixRegx } from "../routersHelpers/matchers.js";

export const createTypeManager = async (
    routesFilesMap: { [key: string]: string },
    fileContents: Map<string, string>
) => {
    // Basic compiler options
    const options = {
        target: ts.ScriptTarget.Latest,
        module: ts.ModuleKind.CommonJS,
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
    };

    console.time("Creating TS Host");
    // Create a CompilerHost with optimized caching
    const host = ts.createCompilerHost(options);
    const sourceFileMap = new Map<string, ts.SourceFile>();

    host.getSourceFile = (fileName: string, languageVersion: ts.ScriptTarget | ts.CreateSourceFileOptions) => {
        // Check cache first
        if (sourceFileMap.has(fileName)) {
            return sourceFileMap.get(fileName);
        }

        // Check file content cache
        let content = fileContents.get(fileName);
        if (!content) {
            content = ts.sys.readFile(fileName) || "";
            fileContents.set(fileName, content);
        }
        const sourceFile = ts.createSourceFile(fileName, content, languageVersion);
        sourceFileMap.set(fileName, sourceFile);
        return sourceFile;
    };

    host.readFile = (fileName) => {
        return fileContents.get(fileName) || ts.sys.readFile(fileName);
    };
    host.fileExists = (fileName) => {
        return fileContents.has(fileName) || ts.sys.fileExists(fileName);
    };
    console.timeEnd("Creating TS Host");

    // Create program
    console.time("Creating TS Program");
    const program = ts.createProgram(Object.keys(routesFilesMap), options, host);
    console.timeEnd("Creating TS Program");
    console.time("Creating TS Checker");
    const checker = program.getTypeChecker();
    console.timeEnd("Creating TS Checker");
    return {
        checker,
        host,
        program,
        sourceFileMap,
    };
};

/* --- Helpers for expanding and stringifying types --- */
const TypeFlags = ts.TypeFlags;
const ObjectFlags = ts.ObjectFlags;

// Pre-compile common type names set for faster lookup
const COMMON_TYPE_NAMES = new Set([
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
]);

// Cache for alias expansions to avoid repeated lookups
const aliasExpansionCache = new WeakMap<ts.Type, ts.Type>();

function isTypeReference(t: any): t is ts.TypeReference {
    return !!(t.flags & TypeFlags.Object) && !!(t.objectFlags & ObjectFlags.Reference);
}

function expandAliasIfNeeded(checker: ts.TypeChecker, type: ts.Type): ts.Type {
    if (!type || !type.aliasSymbol) return type;

    // Check cache first
    const cached = aliasExpansionCache.get(type);
    if (cached) return cached;

    try {
        const declared = checker.getDeclaredTypeOfSymbol(type.aliasSymbol);
        if (declared && declared !== type) {
            aliasExpansionCache.set(type, declared);
            return declared;
        }
    } catch (e) {
        console.error(e);
    }

    aliasExpansionCache.set(type, type);
    return type;
}

// Memoization cache for stringified types using WeakMap (keyed by type + checker + depth + parent hash)
const stringifyCache = new WeakMap<ts.Type, Map<string, string>>();

function getCacheKey(depth: number, parentsNames: string[]): string {
    return `${depth}:${parentsNames.join(",")}`;
}

function stringify(checker: ts.TypeChecker, type: ts.Type, depth = 0, parentsNames: string[] = []): string {
    if (!type) return "any";

    // Check memoization cache
    let typeCache = stringifyCache.get(type);
    if (!typeCache) {
        typeCache = new Map<string, string>();
        stringifyCache.set(type, typeCache);
    }
    const cacheKey = getCacheKey(depth, parentsNames);
    const cached = typeCache.get(cacheKey);
    if (cached) return cached;

    const typeName = checker.typeToString(type);

    // Early return for common cases or circular references
    if (depth > 20 || (!COMMON_TYPE_NAMES.has(typeName) && parentsNames.includes(typeName))) {
        typeCache.set(cacheKey, typeName);
        return typeName;
    }

    const extendedParents = [...parentsNames, typeName];
    let result: string;

    // expand alias
    if (type.aliasSymbol) {
        const declared = expandAliasIfNeeded(checker, type);
        if (declared !== type) {
            result = stringify(checker, declared, depth + 1, extendedParents);
            typeCache.set(cacheKey, result);
            return result;
        }
    }

    // unions / intersections
    if (type.isUnion && type.isUnion()) {
        result = type.types.map((t: any) => stringify(checker, t, depth + 1, extendedParents)).join(" | ");
        typeCache.set(cacheKey, result);
        return result;
    }
    if (type.isIntersection && type.isIntersection()) {
        result = type.types.map((t: any) => stringify(checker, t, depth + 1, extendedParents)).join(" & ");
        typeCache.set(cacheKey, result);
        return result;
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
            result = `${stringify(checker, typeArgs[0], depth + 1, extendedParents)}[]`;
            typeCache.set(cacheKey, result);
            return result;
        }
        if (targetName === "Promise" && typeArgs.length === 1) {
            result = `Promise<${stringify(checker, typeArgs[0], depth + 1, extendedParents)}>`;
            typeCache.set(cacheKey, result);
            return result;
        }
        if (typeArgs.length) {
            result = `${targetName}<${typeArgs
                .map((a) => stringify(checker, a, depth + 1, extendedParents))
                .join(", ")}>`;
            typeCache.set(cacheKey, result);
            return result;
        }
        typeCache.set(cacheKey, targetName);
        return targetName;
    }

    // object types - expand members
    if (type.flags & TypeFlags.Object) {
        const objFlags = (type as any).objectFlags || 0;
        if (objFlags & (ObjectFlags.Anonymous | ObjectFlags.Class | ObjectFlags.Interface)) {
            const props = checker.getPropertiesOfType(type);
            if (!props.length) {
                result = checker.typeToString(type);
                typeCache.set(cacheKey, result);
                return result;
            }
            const members = props.map((p) => {
                const decl = p.valueDeclaration || (p.declarations && p.declarations[0]);
                if (!decl) {
                    return `${p.getName()}: any`;
                }
                const pType = checker.getTypeOfSymbolAtLocation(p, decl);
                const optional = p.flags & ts.SymbolFlags.Optional ? "?" : "";
                return `${p.getName()}${optional}: ${stringify(checker, pType, depth + 1, extendedParents)}`;
            });
            result = `{\n  ${members.join(";\n  ")}\n}`;
            typeCache.set(cacheKey, result);
            return result;
        }
        result = checker.typeToString(type);
        typeCache.set(cacheKey, result);
        return result;
    }

    // literal types
    if (type.flags & (TypeFlags.StringLiteral | TypeFlags.NumberLiteral | TypeFlags.BooleanLiteral)) {
        result = checker.typeToString(type);
        typeCache.set(cacheKey, result);
        return result;
    }

    // fallback
    result = checker.typeToString(type);
    typeCache.set(cacheKey, result);
    return result;
}

const useContextToProcessRouteForTypes = (
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
        const getParamTypeByIndex = (i: number) => {
            if (!paramSymbols[i]) return null;
            const psym = paramSymbols[i];
            const decl = psym.valueDeclaration || (psym.declarations && psym.declarations[0]) || exportExpr;
            return checker.getTypeOfSymbolAtLocation(psym, decl);
        };

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

const useContextToProcessChannelsForTypes = (
    routeFileFullPath: string,
    exportExpr: ts.Expression,
    context: {
        checker: ts.TypeChecker;
        host: ts.CompilerHost;
        program: ts.Program;
    }
): null | { bodyTypeString: string; expectResponse: string } => {
    const { checker, program } = context;

    try {
        const sf = program.getSourceFile(routeFileFullPath);
        if (!sf) return null;

        // Cache source file text to avoid repeated getFullText() calls
        const sourceText = sf.getFullText();
        const snippetOf = (node?: ts.Node) => {
            try {
                if (!node) return "<no-node>";
                const start = Math.max(0, node.getStart() - 20);
                const end = Math.min(sourceText.length, node.getEnd() + 20);
                return sourceText.slice(start, end).replace(/\r?\n/g, " ");
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

const useContextToProcessEventsForTypes = (
    routeFileFullPath: string,
    callExpression: ts.CallExpression,
    context: {
        checker: ts.TypeChecker;
        host: ts.CompilerHost;
        program: ts.Program;
    }
): null | { eventName: string; bodyTypeString: string; responseTypeString: string } => {
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
                const respProp = checker.getPropertyOfType(callType, "response");
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

// Helper to extract HTTP method from AST
const extractMethodFromAST = (sf: ts.SourceFile, defaultExportExpr: ts.Expression | null): string => {
    if (!defaultExportExpr) return "GET";

    // Try to find method property in the exported object
    const findMethodInObject = (node: ts.Node): string | null => {
        if (ts.isObjectLiteralExpression(node)) {
            for (const prop of node.properties) {
                if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name) && prop.name.text === "method") {
                    if (ts.isStringLiteral(prop.initializer) || ts.isNoSubstitutionTemplateLiteral(prop.initializer)) {
                        return prop.initializer.text;
                    }
                }
            }
        } else if (ts.isCallExpression(node)) {
            // Check if it's a route definition call with method as first argument
            if (node.arguments.length > 0) {
                const firstArg = node.arguments[0];
                if (ts.isStringLiteral(firstArg) || ts.isNoSubstitutionTemplateLiteral(firstArg)) {
                    return firstArg.text;
                }
            }
            // Check properties in object argument
            for (const arg of node.arguments) {
                const method = findMethodInObject(arg);
                if (method) return method;
            }
        }
        return null;
    };

    // Traverse the export expression to find method
    let method: string | null = null;
    const visitor = (node: ts.Node): void => {
        if (method) return;
        if (ts.isObjectLiteralExpression(node) || ts.isCallExpression(node)) {
            method = findMethodInObject(node);
            if (method) return;
        }
        ts.forEachChild(node, visitor);
    };
    visitor(defaultExportExpr);

    return method || "GET";
};

export const collectRoutesFilesAndDeleteDescriptions = async () => {
    const routerDirectory = await getRouterDirectory();
    const fs = (await import("fs/promises")).default;
    const path = (await import("path")).default;

    const routesFilesMap: { [key: string]: string } = {};
    const descriptionPreExtensionSuffix = await getDescriptionPreExtensionSuffix();
    const toBeDeletedDescriptions: string[] = [];

    const traverseDirectory = async (directory: string) => {
        const items = await fs.readdir(directory, { withFileTypes: true });

        for (const item of items) {
            const itemPath = path.join(directory, item.name);
            if (item.isDirectory()) {
                await traverseDirectory(itemPath);
            } else {
                const routerMatch = item.name.match(routerSuffixRegx);
                if (!routerMatch) {
                    continue;
                }
                const routerName = item.name.slice(0, item.name.indexOf(routerMatch[0]));
                toBeDeletedDescriptions.push(path.join(directory, `${routerName}${descriptionPreExtensionSuffix}.md`));
                routesFilesMap[itemPath] = itemPath;
            }
        }
    };
    await traverseDirectory(routerDirectory);

    const command = `npx rimraf ${toBeDeletedDescriptions.join(" ")}`;
    execSync(command, { shell: "/bin/bash" });
    return routesFilesMap;
};

export const collectRoutesFiles = async () => {
    const routerDirectory = await getRouterDirectory();
    const fs = (await import("fs/promises")).default;
    const path = (await import("path")).default;

    const routesFilesMap: { [key: string]: string } = {};
    const descriptionPreExtensionSuffix = await getDescriptionPreExtensionSuffix();
    const toBeDeletedDescriptions: string[] = [];

    const traverseDirectory = async (directory: string) => {
        const items = await fs.readdir(directory, { withFileTypes: true });

        for (const item of items) {
            const itemPath = path.join(directory, item.name);
            if (item.isDirectory()) {
                await traverseDirectory(itemPath);
            } else {
                const routerMatch = item.name.match(routerSuffixRegx);
                if (!routerMatch) {
                    continue;
                }
                const routerName = item.name.slice(0, item.name.indexOf(routerMatch[0]));
                toBeDeletedDescriptions.push(path.join(directory, `${routerName}${descriptionPreExtensionSuffix}.md`));
                routesFilesMap[itemPath] = itemPath;
            }
        }
    };
    await traverseDirectory(routerDirectory);

    return { routesFilesMap, toBeDeletedDescriptions };
};

export const processRoutesForTypes = async (routesFilesMap: { [routeFileFullPath: string]: string }) => {
    // Pre-read all file contents in parallel for maximum performance
    const fileContents = new Map<string, string>();
    const filePaths = Object.keys(routesFilesMap);
    await Promise.all(
        filePaths.map(async (filePath) => {
            try {
                const content = await readFile(filePath, "utf-8");
                fileContents.set(filePath, content);
            } catch (error) {
                console.error(`Failed to read file ${filePath}:`, error);
            }
        })
    );

    const tsContext = await createTypeManager(routesFilesMap, fileContents);
    await useContextToProcessTypes(tsContext, filePaths);
};

export const useContextToProcessTypes = async (
    tsContext: {
        checker: ts.TypeChecker;
        host: ts.CompilerHost;
        program: ts.Program;
        sourceFileMap: Map<string, ts.SourceFile>;
    },
    filePaths: string[]
) => {
    // Process all routes sequentially (CPU-bound operations, parallelism not beneficial on single thread)
    // But we process them efficiently with all optimizations
    for (const routeFullPath of filePaths) {
        try {
            // get the source file we care about
            const sf = tsContext.program.getSourceFile(routeFullPath);
            if (!sf) {
                continue;
            }

            // Single-pass AST traversal to extract all needed information
            let defaultExportExpr: ts.Expression | null = null;
            let channelExportExpr: ts.Expression | null = null;
            let eventExpressions: ts.CallExpression[] = [];

            for (const stmt of sf.statements) {
                // Check for event expressions
                if (stmt.kind === ts.SyntaxKind.ExpressionStatement) {
                    const exprStmt = stmt as ts.ExpressionStatement;
                    if (ts.isCallExpression(exprStmt.expression)) {
                        const callExpr = exprStmt.expression as ts.CallExpression;
                        if (
                            ts.isIdentifier(callExpr.expression) &&
                            callExpr.expression.text.startsWith("defineEmittedEvent")
                        ) {
                            // No need to check symbol - if it's an identifier with this name, it's valid
                            eventExpressions.push(callExpr);
                        }
                    }
                }

                // Check for default export
                if (ts.isExportAssignment(stmt) && !stmt.isExportEquals) {
                    defaultExportExpr = stmt.expression;
                }

                // Check for channel handler export
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

            // Process route types (synchronous, optimized with caching)
            const routeTypes = defaultExportExpr
                ? useContextToProcessRouteForTypes(routeFullPath, defaultExportExpr, tsContext)
                : null;

            // Process channel types (synchronous, optimized with caching)
            const channelTypes = channelExportExpr
                ? useContextToProcessChannelsForTypes(routeFullPath, channelExportExpr, tsContext)
                : null;

            // Process event types (synchronous, optimized with caching)
            const eventsTypes: Array<{ eventName: string; bodyTypeString: string; responseTypeString: string }> = [];
            if (eventExpressions.length > 0) {
                for (const evExpr of eventExpressions) {
                    try {
                        const res = useContextToProcessEventsForTypes(routeFullPath, evExpr, tsContext);
                        if (res) {
                            eventsTypes.push(res);
                        }
                    } catch (err) {
                        console.error("Error processing emitted event for types on", routeFullPath, err);
                    }
                }
            }

            // Extract method from AST instead of regex (much faster)
            const method = routeTypes ? extractMethodFromAST(sf, defaultExportExpr) : "GET";

            // Describe routes, channels, and events
            if (routeTypes) {
                describeRoute({
                    fileUrl: pathToFileURL(routeFullPath).toString(),
                    method: method as any,
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
            if (eventsTypes.length > 0) {
                for (const evExpr of eventsTypes) {
                    describeEvent({
                        fileUrl: pathToFileURL(routeFullPath).toString(),
                        event: evExpr.eventName,
                        eventBodyTypeString: evExpr.bodyTypeString,
                        expectedResponseBodyTypeString: evExpr.responseTypeString,
                    });
                }
            }
        } catch (error) {
            console.error(`Error processing route ${routeFullPath}:`, error);
        }
    }
    await storeDescriptions();
};

const storeDescriptions = async () => {
    if (!cluster.isPrimary) {
        return;
    }

    const typesDir = await getTypesPlacementDir();
    await mkdir(typesDir, { recursive: true });
    await writeFile(
        path.join(typesDir, "apiTypes.json"),
        JSON.stringify(
            {
                routesDescriptions: routesDescriptionMap,
                channelsDescriptions: channelsDescriptionsMap,
                eventsDescriptions: eventsDescriptionMap,
            },
            null,
            4
        )
    );
};
