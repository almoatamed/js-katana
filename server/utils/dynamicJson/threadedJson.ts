import cluster from "cluster";
import { randomInt } from "crypto";
import fs from "fs/promises";
import { appIdentityConfig } from "../../config/appIdentity/index.js";
import { lockMethod as LockMethod } from "../common/index.js";
import { redisClient } from "../redis/index.js";
import { redisLock } from "../redis/lock/index.js";

const rs = (await import("$/server/utils/common/index.js")).default.ObjectManipulation.rs;

export type FilePath = string;

export type JsonUpdateQuery = {
    type: "push" | "unshift" | "set";
    selector: string | Array<string>;
    key: string;
    value: any;
};

export type ThreadedJson<JSONDefinition extends any> = {
    get: (selector: string | string[]) => Promise<any>;
    set: (selector: string | string[] | null | undefined, key: string, value: any) => Promise<boolean>;
    push: (arraySelector: string | string[], value: any) => Promise<boolean>;
    removeItemFromArray: (arraySelector: string | string[], item: any, key?: string | number) => Promise<boolean>;
    updateItemInArray: (
        arraySelector: string | string[] | null | undefined,
        item: any,
        updatedItem: any,
        key?: string | number,
    ) => Promise<boolean>;
    splice: (arraySelector: string | string[], startIndex: number, count: number) => Promise<false | any[]>;
    unshift: (selector: string | string[], value: any) => Promise<boolean>;
    batch: (queries: Array<JsonUpdateQuery>) => Promise<void>;
    updateJsonFromProvided: (newContent: JSONDefinition) => Promise<void>;
};

const generatePositiveInt = () => Math.abs(randomInt(1e10));

export type JSONSourceFilePath = `${string}.json`;

type SourceType =
    | {
          type: "jsonFile";
          fileFullPath: string;
      }
    | {
          type: "redis";
          uniqueIdentifier: string;
      }
    | {
          type: "inMemory";
          uniqueIdentifier: string;
      };

async function makeThreadedJson<JSONDefinition extends any>({
    source,
    initialContent,
}: {
    source: SourceType;
    initialContent?: JSONDefinition;
}): Promise<ThreadedJson<JSONDefinition>> {
    const uniqueEventId = `${appIdentityConfig.getName()}:${source.type == "jsonFile" ? source.fileFullPath : source.uniqueIdentifier}`;

    let lockId: string | null = null;

    const lock = async (): Promise<boolean> => {
        if (source.type == "redis" && cluster.isPrimary) {
            lockId = await redisLock.acquire(uniqueEventId);
            return !!lockId;
        } else {
            return true;
        }
    };
    const release = async () => {
        if (source.type == "redis" && lockId) {
            await redisLock.release(uniqueEventId, lockId);
        }
    };

    const lockMethod = <T extends (...args: any[]) => any>(method: T) =>
        LockMethod(
            (async (...args: any) => {
                const locked = await lock();
                if (locked) {
                    try {
                        method(...args);
                    } catch (error) {
                        throw error;
                    } finally {
                        release();
                    }
                }
                throw new Error("failed to acquire redis Lock");
            }) as T,
            {
                lockName: uniqueEventId,
                lockTimeout: 5e3,
            },
        );

    if (cluster.isPrimary) {
        let inMemory = initialContent || {};
        if (source.type == "jsonFile") {
            if (initialContent && !(await fs.exists(source.fileFullPath))) {
                await fs.writeFile(source.fileFullPath, JSON.stringify(initialContent));
            }
        } else if (source.type == "redis") {
            if (initialContent) {
                const existantContent = await redisClient.get(uniqueEventId);
                if (!existantContent) {
                    const locked = await lock();
                    if (locked) {
                        try {
                            await redisClient.set(uniqueEventId, JSON.stringify(initialContent));
                        } catch (error) {
                            throw error;
                        } finally {
                            release();
                        }
                    }
                }
            }
        }

        const getAllData = async () => {
            let result: any;
            if (source.type == "inMemory") {
                result = inMemory;
            } else if (source.type == "redis" && redisClient) {
                result = await redisClient.get(uniqueEventId);
            } else if (source.type === "jsonFile" && (await fs.exists(source.fileFullPath))) {
                result = JSON.parse(await fs.readFile(source.fileFullPath, "utf-8"));
            } else {
                result = {};
            }
            return result || {};
        };

        const update = async (updatedData: JSONDefinition) => {
            if (source.type == "jsonFile") {
                await fs.writeFile(source.fileFullPath, JSON.stringify(updatedData));
            } else if (source.type == "redis") {
                await redisClient.set(uniqueEventId, JSON.stringify(updatedData));
            }
        };

        const setDirect = lockMethod(async function (
            selector: string | string[] | null | undefined,
            key: string,
            value: any,
        ) {
            const data = await getAllData();
            const target = rs(selector || [], data);
            if (typeof target == "object" && !!target && !Array.isArray(target)) {
                target[key] = value;
                update(data);
                return true;
            } else {
                return false;
            }
        });

        const pushDirect = lockMethod(async function (selector: string | string[], value: any) {
            const data = await getAllData();
            const target = rs(selector, data);
            if (typeof target === "object" && Array.isArray(target)) {
                target.push(value);
                update(data);
                return true;
            } else {
                return false;
            }
        });

        const unshiftDirect = lockMethod(async function (selector, value) {
            const data = await getAllData();
            const target = rs(selector, data);
            if (typeof target === "object" && Array.isArray(target)) {
                target.unshift(value);
                update(data);
                return true;
            } else {
                return false;
            }
        });

        const removeItemFromArrayDirect = lockMethod(async function (selector, item, key) {
            const data = await getAllData();
            const target = rs(selector, data);
            if (typeof target === "object" && Array.isArray(target)) {
                const itemIndex = target.findIndex((ti) => {
                    if (!key) {
                        return ti == item;
                    } else {
                        return ti[key] == item[key];
                    }
                });
                if (itemIndex != -1) {
                    target.splice(itemIndex, 1);
                    update(data);
                    return true;
                } else {
                    return false;
                }
            } else {
                return false;
            }
        });

        const updateItemInArrayDirect = lockMethod(async function (selector, item, updatedItem, key) {
            const data = await getAllData();
            const target = rs(selector, data);
            if (typeof target === "object" && Array.isArray(target)) {
                const itemIndex = target.findIndex((ti) => {
                    if (!key) {
                        return ti === item;
                    } else {
                        return ti[key] == item[key];
                    }
                });
                if (itemIndex != -1) {
                    if (typeof target[itemIndex] == "object") {
                        target[itemIndex] = {
                            ...target[itemIndex],
                            updatedItem,
                        };
                    } else {
                        target[itemIndex] = updatedItem;
                    }
                    update(data);
                    return true;
                } else {
                    return false;
                }
            } else {
                return false;
            }
        });

        const batchSetDirect = lockMethod(async function (queries: Array<JsonUpdateQuery>) {
            const data = await getAllData();
            for (const query of queries) {
                if (query.type == "push") {
                    const target = rs(query.selector, data);
                    if (typeof target === "object" && Array.isArray(target)) {
                        target.push(query.value);
                    }
                } else if (query.type == "set") {
                    const target = rs(query.selector, data);
                    if (typeof target === "object" && !!target) {
                        target[query.key] = query.value;
                    }
                } else if (query.type == "unshift") {
                    const target = rs(query.selector, data);
                    if (typeof target === "object" && Array.isArray(target)) {
                        target.unshift(query.value);
                    }
                }
            }
            update(data);
        });

        const spliceDirect = lockMethod(async function (selector, startIndex: number, deleteCount: number) {
            const data = await getAllData();
            const target = rs(selector, data);
            if (typeof target === "object" && Array.isArray(target)) {
                const result = target.splice(startIndex, deleteCount);
                update(data);
                return result;
            } else {
                return false;
            }
        });

        const popDirect = lockMethod(async function (selector) {
            const data = await getAllData();
            const target = rs(selector, data);
            if (typeof target === "object" && Array.isArray(target)) {
                const result = target.pop();
                update(data);
                return result;
            } else {
                return false;
            }
        });

        const shiftDirect = lockMethod(async function (selector) {
            const data = await getAllData();
            const target = rs(selector, data);
            if (typeof target === "object" && Array.isArray(target)) {
                const result = target.shift();
                update(data);
                return result;
            } else {
                return false;
            }
        });
        const updateJsonFromProvided = lockMethod(async (newData: JSONDefinition) => {
            return await update(newData);
        });

        const workersListeners: import("cluster").Worker[] = [];
        for (const worker of Object.values(cluster.workers || {})) {
            worker &&
                workersListeners.push(
                    worker.on("message", async (msg, socket) => {
                        try {
                            if (msg.request == uniqueEventId) {
                                if (msg.query?.type == "get") {
                                    worker.send({
                                        queryId: msg.queryId,
                                        result: rs(msg.query.selector, await getAllData()),
                                        finished: true,
                                    });
                                } else {
                                    let result;
                                    if (msg.query?.type == "set") {
                                        result = await setDirect(msg.query.selector, msg.query.key, msg.query.value);
                                    } else if (msg.query?.type == "push") {
                                        result = await pushDirect(msg.query.selector, msg.query.value);
                                    } else if (msg.query?.type == "unshift") {
                                        result = await unshiftDirect(msg.query.selector, msg.query.value);
                                    } else if (msg.query?.type == "arraySet") {
                                        result = await batchSetDirect(msg.query.queries);
                                    } else if (msg.query?.type == "pop") {
                                        result = await popDirect(msg.query.selector);
                                    } else if (msg.query?.type == "removeItemFromArray") {
                                        result = await removeItemFromArrayDirect(
                                            msg.query.selector,
                                            msg.query.item,
                                            msg.query.key,
                                        );
                                    } else if (msg.query?.type == "updateItemInArray") {
                                        result = await updateItemInArrayDirect(
                                            msg.query.selector,
                                            msg.query.item,
                                            msg.query.updatedItem,
                                            msg.query.key,
                                        );
                                    } else if (msg.query?.type == "shift") {
                                        result = await shiftDirect(msg.query.selector);
                                    } else if (msg.query?.type == "splice") {
                                        result = await spliceDirect(
                                            msg.query.selector,
                                            msg.query.startIndex,
                                            msg.query.deleteCount,
                                        );
                                    } else if (msg.query?.type == "updateJsonFromProvided") {
                                        result = await updateJsonFromProvided(msg.query.data);
                                    }

                                    worker.send({
                                        queryId: msg.queryId,
                                        finished: true,
                                        result,
                                    });
                                }
                            }
                        } catch (error: any) {
                            worker.send({
                                queryId: msg.queryId,
                                finished: true,
                                error,
                            });
                        }
                    }),
                );
        }

        const result: ThreadedJson<JSONDefinition> = {
            batch: batchSetDirect,
            get: async (selector) => {
                return rs(selector, await getAllData());
            },
            push: pushDirect,
            removeItemFromArray: removeItemFromArrayDirect,
            set: setDirect,
            splice: spliceDirect,
            unshift: unshiftDirect,
            updateItemInArray: updateItemInArrayDirect,
            updateJsonFromProvided,
        };
        return result;
    } else {
        const get = async function (selector: string | string[]) {
            const query = {
                type: "get",
                selector: selector,
            };
            return await sendQuery(query);
        };

        const updateItemInArray = async function (
            selector: string | string[] | null | undefined,
            item: any,
            updatedItem: any,
            key?: string | number,
        ) {
            const query = {
                type: "updateItemInArray",
                selector,
                item,
                updatedItem,
                key,
            };
            return await sendQuery(query);
        };

        const updateJsonFromProvided = async function (newJson: JSONDefinition) {
            const query = {
                type: "data",
                data: newJson,
            };
            return await sendQuery(query);
        };

        const removeItemFromArray = async function (selector: string | string[], item: any, key?: string | number) {
            const query = {
                type: "removeItemFromArray",
                selector,
                item,
                key,
            };
            return await sendQuery(query);
        };

        const splice = async function (
            selector: string | string[] | null | undefined,
            startIndex: number,
            deleteCount: number,
        ) {
            const query = {
                type: "splice",
                selector: selector,
                startIndex,
                deleteCount,
            };
            return await sendQuery(query);
        };

        const pop = async function (selector: string) {
            const query = {
                type: "pop",
                selector: selector,
            };
            return await sendQuery(query);
        };

        const shift = async function (selector: string) {
            const query = {
                type: "shift",
                selector: selector,
            };
            return await sendQuery(query);
        };

        const set = async function (selector: string | string[] | null | undefined, key: string, value: any) {
            const query = {
                type: "set",
                selector: selector,
                key: key,
                value: value,
            };
            return await sendQuery(query);
        };

        const push = async function (selector, value) {
            const query = {
                type: "push",
                selector: selector,
                value: value,
            };
            return await sendQuery(query);
        };

        const unshift = async function (selector, value) {
            const query = {
                type: "unshift",
                selector: selector,
                value: value,
            };
            return await sendQuery(query);
        };

        const batch = async function (queries: Array<JsonUpdateQuery>) {
            const query = {
                type: "arraySet",
                queries: queries,
            };
            return await sendQuery(query);
        };

        const sendQuery = async (query: any) => {
            const queryId = generatePositiveInt();
            process.send?.({
                request: uniqueEventId,
                queryId: queryId,
                query: query,
            });
            return await waitForQueryNumber(queryId);
        };

        const waitForQueryNumber = (queryId) => {
            return new Promise<any>((resolve, reject) => {
                const handler = (msg) => {
                    if (msg.queryId == queryId && msg.finished) {
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
                    } catch (error: any) {
                        console.log(error);
                    } finally {
                        reject("Timeout");
                    }
                }, 5e3);
            });
        };

        return {
            batch,
            get,
            push,
            removeItemFromArray,
            set,
            splice,
            unshift,
            updateItemInArray,
            updateJsonFromProvided,
        };
    }
}

export default makeThreadedJson;
export { makeThreadedJson };
