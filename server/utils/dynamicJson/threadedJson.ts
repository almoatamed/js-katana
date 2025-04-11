import cluster from "cluster";
import { randomInt } from "crypto";
import fs from "fs";

import { lockMethod as LockMethod, JSONObject } from "../common/index.js";

const rs = (await import("$/server/utils/common/index.js")).default.ObjectManipulation.rs;

export type FilePath = string;

export type JsonUpdateQuery = {
    type: "push" | "unshift" | "set";
    selector: string | Array<string>;
    key: string;
    value: any;
};

export type ThreadedJson<SourceType, JSONDefinition extends any> = {
    get: (selector: string | string[]) => Promise<any>;
    set: (selector: string | string[] | null | undefined, key: string, value: any) => Promise<boolean>;
    push: (arraySelector: string | string[], value: any) => Promise<boolean>;
    removeItemFromArray: (arraySelector: string | string[], item: any, key?: string) => Promise<boolean>;
    updatedItemInArray: (
        arraySelector: string | string[],
        item: any,
        updatedItem: any,
        key?: string,
    ) => Promise<boolean>;
    splice: (arraySelector: string | string[], value: any) => Promise<boolean>;
    unshift: (selector: string | string[], value: any) => Promise<boolean>;
    setArray: (queries: Array<JsonUpdateQuery>) => Promise<boolean>;
    setMultipleQueries: (queries: Array<JsonUpdateQuery>) => Promise<boolean>;
} & (SourceType extends string
    ? {
          updateJsonFromProvided: (newContent: JSONDefinition) => Promise<void>;
          requestUpdate: () => Promise<void>;
      }
    : {});

export type OptionsNoBroadCast<SourceType> = {
    lazy?: boolean;
    uniqueEventNumber: SourceType extends string ? string | undefined : string;
    broadcastOnUpdate: false;
    filePath?: string;
};

export type Options<SourceType> = {
    lazy?: boolean;
    uniqueEventNumber: SourceType extends string ? string | undefined : string;
    broadcastOnUpdate?: true;
    filePath?: string;
};

const generatePositiveInt = () => Math.abs(randomInt(1e10));

export type JSONSourceFilePath = `${string}.js` | `${string}.json`;

async function makeThreadedJson<
    JSONDefinition extends any,
    SourceType extends JSONSourceFilePath | JSONObject,
    OptionsType extends Options<SourceType> | OptionsNoBroadCast<SourceType>,
>(
    source: SourceType,
    options: OptionsType,
): Promise<
    OptionsType extends OptionsNoBroadCast<SourceType>
        ? ThreadedJson<SourceType, JSONDefinition>
        : SourceType extends string
          ? JSONDefinition & ThreadedJson<SourceType, JSONDefinition>
          : SourceType & ThreadedJson<SourceType, JSONDefinition>
> {
    const uniqueEventNumber = `${options.uniqueEventNumber || source}`;
    const requestEventName = `${uniqueEventNumber}`;

    let json: any;
    let failCountOnOpeningFileSourceFile = 0;
    const jsonFilePath: string | null =
        options?.filePath || (typeof source == "string" && source.endsWith(".json") ? source : null);
    if (typeof source == "string") {
        while (true) {
            try {
                if (source.endsWith(".js")) {
                    json = (await import(source)).default;
                } else {
                    json = JSON.parse(fs.readFileSync(source, "utf-8"));
                }
                break;
            } catch (error: any) {
                console.log("Error on JSON", error.message || error.msg || error.name);
                failCountOnOpeningFileSourceFile += 1;
                if (failCountOnOpeningFileSourceFile > 3) {
                    process.exit(-1);
                }
                continue;
            }
        }
    } else {
        json = source;
    }

    const lockMethod = <T extends (...args: any[]) => any>(method: T) =>
        LockMethod(method, {
            lockName: requestEventName,
            lockTimeout: 5e3,
        });

    json.uniqueEventNumber = uniqueEventNumber;

    function getFiltered() {
        const filtered = {};
        for (const key in json) {
            if (!(typeof json[key] == "function" || key.startsWith("_") || key == "processListener")) {
                filtered[key] = json[key];
            }
        }
        return filtered;
    }

    json.update = function (queryNumber) {
        const filtered = getFiltered();
        if (!options.lazy && jsonFilePath) {
            fs.writeFileSync(jsonFilePath, JSON.stringify(filtered, null, 4));
        }
        if (options?.broadcastOnUpdate === undefined || options?.broadcastOnUpdate === true) {
            for (const worker of Object.values(cluster.workers || {})) {
                worker?.send({
                    request: requestEventName,
                    queryNumber: queryNumber,
                    json: filtered,
                    update: true,
                });
            }
        }
    };

    if (cluster.isPrimary) {
        json.UpdateRequest = lockMethod(function (filtered, queryNumber) {
            for (const key in filtered) {
                if (typeof json[key] == "function") {
                    continue;
                }
                json[key] = filtered[key];
            }

            if (options.lazy && jsonFilePath) {
                fs.writeFileSync(jsonFilePath, JSON.stringify(filtered, null, 4));
            }
            json.update(queryNumber);
        });

        json.SetDirect = lockMethod(function (selector, key, value, queryNumber) {
            const Target = rs(selector, json);

            if (typeof Target == "object" && !!Target && !Array.isArray(Target)) {
                Target[key] = value;
                json.update(queryNumber);
                return true;
            } else {
                return false;
            }
        });

        json.PushDirect = lockMethod(function (selector, value, queryNumber) {
            const Target = rs(selector, json);
            if (typeof Target === "object" && Array.isArray(Target)) {
                Target.push(value);
                json.update(queryNumber);
                return true;
            } else {
                return false;
            }
        });
        json.UnshiftDirect = lockMethod(function (selector, value, queryNumber) {
            const Target = rs(selector, json);
            if (typeof Target === "object" && Array.isArray(Target)) {
                Target.unshift(value);
                json.update(queryNumber);
                return true;
            } else {
                return false;
            }
        });

        json.RemoveItemFromArrayDirect = lockMethod(function (selector, item, key, queryNumber) {
            const Target = rs(selector, json);
            if (typeof Target === "object" && Array.isArray(Target)) {
                const itemIndex = Target.findIndex((ti) => {
                    if (!key) {
                        return ti == item;
                    } else {
                        return ti[key] == item[key];
                    }
                });
                if (itemIndex != -1) {
                    Target.splice(itemIndex, 1);
                    json.update(queryNumber);
                    return true;
                } else {
                    return false;
                }
            } else {
                return false;
            }
        });

        json.UpdateItemInArrayDirect = lockMethod(function (selector, item, updatedItem, key, queryNumber) {
            const Target = rs(selector, json);
            if (typeof Target === "object" && Array.isArray(Target)) {
                const itemIndex = Target.findIndex((ti) => {
                    if (!key) {
                        return ti === item;
                    } else {
                        return ti[key] == item[key];
                    }
                });
                if (itemIndex != -1) {
                    if (typeof Target[itemIndex] == "object") {
                        Target[itemIndex] = {
                            ...Target[itemIndex],
                            updatedItem,
                        };
                    } else {
                        Target[itemIndex] = updatedItem;
                    }
                    json.update(queryNumber);
                    return true;
                } else {
                    return false;
                }
            } else {
                return false;
            }
        });

        /**
         *
         * @param {Array<JsonUpdateQuery>} queries
         */
        json.ArraySetDirect = lockMethod(function (queries, queryNumber) {
            for (const query of queries) {
                if (query.type == "push") {
                    const Target = rs(query.selector, json);
                    if (typeof Target === "object" && Array.isArray(Target)) {
                        Target.push(query.value);
                    }
                } else if (query.type == "set") {
                    const Target = rs(query.selector, json);
                    if (typeof Target === "object" && !!Target) {
                        Target[query.key] = query.value;
                    }
                } else if (query.type == "unshift") {
                    const Target = rs(query.selector, json);
                    if (typeof Target === "object" && Array.isArray(Target)) {
                        Target.unshift(query.value);
                    }
                }
            }
            json.update(queryNumber);
        });

        json.SpliceDirect = lockMethod(function (selector, startIndex: number, deleteCount: number, queryNumber) {
            const Target = rs(selector, json);
            if (typeof Target === "object" && Array.isArray(Target)) {
                const result = Target.splice(startIndex, deleteCount);
                json.update(queryNumber);
                return result;
            } else {
                return false;
            }
        });

        json.PopDirect = lockMethod(function (selector, queryNumber) {
            const Target = rs(selector, json);
            if (typeof Target === "object" && Array.isArray(Target)) {
                const result = Target.pop();
                json.update(queryNumber);
                return result;
            } else {
                return false;
            }
        });

        json.ShiftDirect = lockMethod(function (selector, queryNumber) {
            const Target = rs(selector, json);
            if (typeof Target === "object" && Array.isArray(Target)) {
                const result = Target.shift();
                json.update(queryNumber);
                return result;
            } else {
                return false;
            }
        });

        json.WorkersListeners = [];
        for (const worker of Object.values(cluster.workers || {})) {
            json.WorkersListeners.push(
                worker?.on("message", async (msg, socket) => {
                    try {
                        if (msg.request == requestEventName) {
                            if (msg.query?.type == "get") {
                                worker.send({
                                    queryNumber: msg.queryNumber,
                                    result: rs(msg.query.selector, json),
                                    finished: true,
                                });
                            } else {
                                let result;
                                if (msg.query?.type == "set") {
                                    result = await json.SetDirect(
                                        msg.query.selector,
                                        msg.query.key,
                                        msg.query.value,
                                        msg.queryNumber,
                                    );
                                } else if (msg.query?.type == "push") {
                                    result = await json.PushDirect(
                                        msg.query.selector,
                                        msg.query.value,
                                        msg.queryNumber,
                                    );
                                } else if (msg.query?.type == "unshift") {
                                    result = await json.UnshiftDirect(
                                        msg.query.selector,
                                        msg.query.value,
                                        msg.queryNumber,
                                    );
                                } else if (msg.query?.type == "arraySet") {
                                    result = await json.ArraySetDirect(msg.query.queries, msg.queryNumber);
                                } else if (msg.query?.type == "update") {
                                    result = await json.UpdateRequest(msg.query.value, msg.queryNumber);
                                } else if (msg.query?.type == "pop") {
                                    result = await json.PopDirect(msg.query.selector, msg.queryNumber);
                                } else if (msg.query?.type == "removeItemFromArray") {
                                    result = await json.RemoveItemFromArrayDirect(
                                        msg.query.selector,
                                        msg.query.item,
                                        msg.query.key,
                                        msg.queryNumber,
                                    );
                                } else if (msg.query?.type == "updateItemInArray") {
                                    result = await json.UpdateItemInArrayDirect(
                                        msg.query.selector,
                                        msg.query.item,
                                        msg.query.updatedItem,
                                        msg.query.key,
                                        msg.queryNumber,
                                    );
                                } else if (msg.query?.type == "shift") {
                                    result = await json.ShiftDirect(msg.query.selector, msg.queryNumber);
                                } else if (msg.query?.type == "splice") {
                                    result = await json.SpliceDirect(
                                        msg.query.selector,
                                        msg.query.startIndex,
                                        msg.query.deleteCount,
                                        msg.queryNumber,
                                    );
                                }

                                worker.send({
                                    queryNumber: msg.queryNumber,
                                    finished: true,
                                    result,
                                });
                            }
                        }
                    } catch (error: any) {
                        worker.send({
                            queryNumber: msg.queryNumber,
                            finished: true,
                            error,
                        });
                    }
                }),
            );
        }
    } else {
        json.processListener = process.on("message", (msg: any) => {
            if (msg.request == requestEventName && msg.update) {
                for (const key in msg.json) {
                    if (typeof json[key] == "function") {
                        continue;
                    }
                    json[key] = msg.json[key];
                }
            }
        });
    }

    json.get = async function (selector) {
        if (cluster.isPrimary) {
            // console.log("looking for selector", selector, rs(selector, json));
            return rs(selector, json);
        } else {
            const query = {
                type: "get",
                selector: selector,
            };
            return await sendQuery(query);
        }
    };

    json.updateItemInArray = async function (selector: string, item: any, updatedItem: any, key: number) {
        if (cluster.isPrimary) {
            return json.UpdateItemInArrayDirect(selector, item, key);
        } else {
            const query = {
                type: "updateItemInArray",
                selector,
                item,
                updatedItem,
                key,
            };
            return await sendQuery(query);
        }
    };

    json.updateJsonFromProvided = async function (newJson: any) {
        if (cluster.isPrimary) {
            return json.UpdateRequest(newJson);
        } else {
            const query = {
                type: "update",
                value: newJson,
            };
            return await sendQuery(query);
        }
    };

    json.removeItemFromArray = async function (selector: string, item: any, key: number) {
        if (cluster.isPrimary) {
            return json.RemoveItemFromArrayDirect(selector, item, key);
        } else {
            const query = {
                type: "removeItemFromArray",
                selector,
                item,
                key,
            };
            return await sendQuery(query);
        }
    };
    json.splice = async function (selector: string, startIndex: number, deleteCount: number) {
        if (cluster.isPrimary) {
            return json.SpliceDirect(selector, startIndex, deleteCount);
        } else {
            const query = {
                type: "splice",
                selector: selector,
                startIndex,
                deleteCount,
            };
            return await sendQuery(query);
        }
    };

    json.pop = async function (selector: string) {
        if (cluster.isPrimary) {
            return json.PopDirect(selector);
        } else {
            const query = {
                type: "pop",
                selector: selector,
            };
            return await sendQuery(query);
        }
    };

    json.shift = async function (selector: string) {
        if (cluster.isPrimary) {
            return json.ShiftDirect(selector);
        } else {
            const query = {
                type: "shift",
                selector: selector,
            };
            return await sendQuery(query);
        }
    };

    json.set = async function (selector: string, key: string, value: any) {
        if (cluster.isPrimary) {
            return json.SetDirect(selector, key, value);
        } else {
            const query = {
                type: "set",
                selector: selector,
                key: key,
                value: value,
            };
            return await sendQuery(query);
        }
    };

    json.set = async function (selector: string, key: string, value: any) {
        if (cluster.isPrimary) {
            return json.SetDirect(selector, key, value);
        } else {
            const query = {
                type: "set",
                selector: selector,
                key: key,
                value: value,
            };
            return await sendQuery(query);
        }
    };

    json.push = async function (selector, value) {
        if (cluster.isPrimary) {
            return json.PushDirect(selector, value);
        } else {
            const query = {
                type: "push",
                selector: selector,
                value: value,
            };
            return await sendQuery(query);
        }
    };

    json.unshift = async function (selector, value) {
        if (cluster.isPrimary) {
            return json.UnshiftDirect(selector, value);
        } else {
            const query = {
                type: "unshift",
                selector: selector,
                value: value,
            };
            return await sendQuery(query);
        }
    };

    json.setArray = async function (queries: Array<JsonUpdateQuery>) {
        if (cluster.isPrimary) {
            return json.ArraySetDirect(queries);
        } else {
            const query = {
                type: "arraySet",
                queries: queries,
            };
            return await sendQuery(query);
        }
    };

    json.setMultipleQueries = json.setArray;

    json.requestUpdate = async function () {
        if (cluster.isPrimary) {
            return json.update();
        } else {
            const filtered = getFiltered();
            const query = {
                type: "update",
                value: filtered,
            };
            await sendQuery(query);
        }
    };

    const sendQuery = async (query) => {
        const queryNumber = generatePositiveInt();
        process.send?.({
            request: requestEventName,
            queryNumber: queryNumber,
            query: query,
        });
        return await waitForQueryNumber(queryNumber);
    };

    const waitForQueryNumber = (queryNumber) => {
        return new Promise((resolve, reject) => {
            const handler = (msg) => {
                if (msg.queryNumber == queryNumber && msg.finished) {
                    if (msg.error) {
                        reject(msg.error);
                    } else {
                        resolve(msg.result);
                    }
                    clearTimeout(timer);
                    process.removeListener("message", handler);
                }
            };
            process.addListener("message", handler);
            const timer = setTimeout(() => {
                try {
                    process.removeListener("message", handler);
                    reject("Timeout");
                } catch (error: any) {
                    console.log(error);
                }
            }, 5e3);
        });
    };

    return json;
}

export default makeThreadedJson;
export {makeThreadedJson}