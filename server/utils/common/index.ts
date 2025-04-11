import AsyncLock from "async-lock";
import fs from "fs";
import path from "path";
import URL from "url";
import { ArgumentsType } from "vitest";
import { routerConfig } from "../../config/routing/index.js";
const axios = (await import("axios")).default;

export const numberToI32Hex = (number: number) => number.toString(16).slice(-8).padStart(8, "0");

export type BatcherOptions = {
    periodInMs: number;
};


export const createBatcher = <T>(
    cb: (props?: T[]) => any,
    id: string,
    options: BatcherOptions = {
        periodInMs: 300,
    },
) => {
    let timeout = null as any;
    const batched = [] as T[];

    let lastUpdated = -Infinity;

    const callBatcher = async (props?: T[], pendingCallbacks?: ((error?: any) => any)[]): Promise<void> => {
        try {
            lastUpdated = Date.now();
            await cb(props);
            callPendingCallbacks(null, pendingCallbacks);
        } catch (error: any) {
            callPendingCallbacks(error, pendingCallbacks);
        }
    };

    const pendingCallbacks = [] as ((error?: any) => any)[];
    const timeoutPeriod = options.periodInMs + 7;
    const callPendingCallbacks = (error?: any, pendingCallbacks?: ((error?: any) => any)[]) => {
        setTimeout(
            () =>
                pendingCallbacks?.splice(0).map(async (cb) => {
                    try {
                        if (error) {
                            await cb(error);
                        } else {
                            await cb();
                        }
                    } catch (error) {
                        console.log("failed to process cb for batcher", id, error);
                    }
                }),
            57,
        );
    };

    return {
        set: lockMethod(
            (props?: T, cb?: (error?: any) => any) => {
                if (props) {
                    batched.push(props);
                }
                if (cb) {
                    pendingCallbacks.push(cb);
                }
                if (
                    (timeout && Date.now() - lastUpdated >= timeoutPeriod) ||
                    Date.now() - lastUpdated > timeoutPeriod * 10
                ) {
                    callBatcher(batched.splice(0), pendingCallbacks.splice(0));
                } else {
                    clearTimeout(timeout);
                    timeout = setTimeout(async () => {
                        await callBatcher(batched.splice(0), pendingCallbacks.splice(0));
                    }, timeoutPeriod);
                }
            },
            {
                lockTimeout: 120e3,
                lockName: id,
            },
        ),
        async setNow(props?: T) {
            props && batched.push(props);
            try {
                await cb(batched.splice(0));
            } catch (error: any) {
                console.log("Batch error", id, String(error?.message));
            }
        },
        clearTimeoutHandler() {
            clearTimeout(timeout);
        },
    };
};

export const createHexFromTagValues = (props: { contentId: number; contentValue: number }) => {
    return `${numberToI32Hex(props.contentId)}${numberToI32Hex(props.contentValue)}`;
};
export const createEpcFromValues = (props: { contentId: number; contentValue: number }) => {
    const random =
        Number((Date.now() + Math.floor(10e3 * Math.random())).toString().split("").reverse().join("")).toString() +
        Number((Date.now() + Math.floor(10e3 * Math.random())).toString().split("").reverse().join("")).toString();
    const epc = (createHexFromTagValues(props) + random).slice(0, 24);
    return epc;
};
const loadJson = (jsonPath: fs.PathOrFileDescriptor) => {
    let json = fs.readFileSync(jsonPath, "utf-8");
    json = json
        .split("\n")
        .filter((line) => {
            return !line.match(/^\s*?\/\//);
        })
        .join("\n");
    json = json.replaceAll(/\/\*(.|\n)*?\*\//g, "");
    json = json.replaceAll(/\,((\s|\n)*?(?:\}|\]))/g, "$1");
    json = JSON.parse(json);
    return json;
};


export type BasicTypes = boolean | number | string | null | undefined;
export type RecursiveReadable =
    | BasicTypes
    | {
          [key: string]: RecursiveReadable;
      }
    | RecursiveReadable[];
export type JSONObject = {
    [key: string]: RecursiveReadable;
};

export type Merge<T, U> = T & Omit<U, keyof T>;

export type OmitFunctions<T> = Pick<
    T,
    {
        [K in keyof T]: T[K] extends Function ? never : K;
    }[keyof T]
>;

export type NestedType<EndType> = EndType | ListNestedType<EndType>;
type ListNestedType<EndType> = NestedType<EndType>[];

export type ShallowObject = {
    [key: string]: BasicTypes | undefined;
};

export const compareShallowRecord = (a: ShallowObject, b: ShallowObject) => {
    const aEntries = Object.entries(a);
    const bEntries = Object.entries(b);
    if (aEntries.length != bEntries.length) {
        return false;
    }
    for (let i = 0; i < aEntries.length; i++) {
        const aEntry = aEntries[i];
        const bEntry = bEntries[i];
        if (aEntry[0] != bEntry[0] || aEntry[1] != bEntry[1]) {
            return false;
        }
    }

    return true;
};

export const isBun = () => {
    try {
        // @ts-ignore
        return !!Bun;
    } catch (error: any) {
        return false;
    }
};

export const surfaceNestedType = <EndType>(nested: NestedType<EndType>[], _Root = true, _List: EndType[] = []) => {
    if (_Root) {
        _List = [];
    }

    for (const item of nested) {
        if (Array.isArray(item)) {
            surfaceNestedType(item, false, _List);
        } else {
            _List.push(item);
        }
    }

    return _List;
};
export const resolveTs = (path: string) => {
    if (path.endsWith(".ts")) {
        path = path.replace(/\.ts$/, ".js");
    }
    return path;
};

const appPath = path.resolve(path.join(path.dirname(URL.fileURLToPath(import.meta.url)), "../../../."));
const srcPath = path.resolve(path.join(path.dirname(URL.fileURLToPath(import.meta.url)), "../../."));

const lock = new AsyncLock({ maxExecutionTime: 5e3 });

export const lockMethod = function <T extends (...args: any[]) => any>(
    method: T,
    {
        lockName,
        lockTimeout = 1e4,
    }: {
        lockName: string;
        lockTimeout?: number;
    },
): (...args: ArgumentsType<T>) => Promise<ReturnType<T>> {
    const originalMethod = method;
    return async function (...args: any[]) {
        return new Promise(async (resolve, reject) => {
            try {
                await lock.acquire(
                    lockName,
                    async () => {
                        try {
                            return resolve(await originalMethod(...args));
                        } catch (error: any) {
                            reject(error);
                        }
                    },
                    {
                        timeout: lockTimeout,
                    },
                );
            } catch (error: any) {
                reject(error);
            }
        });
    };
};

export function resolvePath(relativePath, baseUrl) {
    return URL.fileURLToPath(new URL.URL(relativePath, baseUrl));
}

export const relativeToAbsolutePath = resolvePath;

export function createPathResolver(baseUrl: string) {
    function resolve(inputPath: string): string {
        if (inputPath.startsWith(`$/`)) {
            return path.join(appPath, inputPath.slice(2));
        } else {
            return URL.fileURLToPath(new URL.URL(inputPath, baseUrl));
        }
    }
    return resolve;
}

export async function downloadFile(url: string, body: any, outputPath: string): Promise<boolean> {
    const writer = fs.createWriteStream(outputPath);

    const ax = axios as any;

    return ax({
        method: "post",
        url: url,
        data: body,
        responseType: "stream",
    }).then((response) => {
        return new Promise((resolve, reject): any => {
            response.data.pipe(writer);
            let error: any = null;
            writer.on("error", (err) => {
                error = err;
                writer.close();
                reject(err);
            });
            writer.on("close", () => {
                if (!error) {
                    resolve(true);
                }
                //no need to call the reject here, as it will have been called in the
                //'error' stream;
            });
        });
    });
}

export function clip(text: string, maxLength: number): string {
    if (!text) {
        return "";
    }
    if (text.length > maxLength) {
        return `${text.slice(0, maxLength - 3)}...`;
    } else {
        return text;
    }
}

export function recursiveSelect(selector: string | Array<string>, obj: any): any {
    if (typeof selector == "string") {
        selector = selector.split(".").filter((s) => !!s);
    }

    if (!selector || !selector.length) {
        return obj;
    }
    try {
        return recursiveSelect(selector.slice(1), obj[selector[0]]);
    } catch (error: any) {
        // console.log("Recursive select error", error);
        return undefined;
    }
}

function padId(id: string | number): string {
    return "#" + String(id).padStart(10, "0");
}
export { padId };

function fixed(value: string | number | null | undefined, n = 2) {
    return Number(Number(value).toFixed(n));
}

const math = {
    fixed,
    ceil: fixed,
    min: (arr: Array<number>): number => Math.min(...arr.filter((el) => !Number.isNaN(Number(el)))),
    max: (arr: Array<number>): number => Math.max(...arr.filter((el) => !Number.isNaN(Number(el)))),
};
export { math };

function cap(str: string) {
    return str.replaceAll(/\b\w+\b/gi, (match) => {
        const string = match;
        return string.charAt(0).toUpperCase() + string.slice(1);
    });
}
export { cap };

export type SearchBase = {
    search?: string;
    skip?: number;
    take?: number;
};

export type RemoveNull<T> = T extends null ? never : T;

export const values = <T extends { [key: symbol | number | string]: any }>(
    target?: T | null,
): T extends { [key: string | symbol | number]: infer R } ? RemoveNull<R>[] : any[] => {
    if (!target) {
        return [] as any;
    }
    const values = Object.values(target).filter((i) => i !== undefined && i !== null);
    return values as any;
};

export const isNumber = function (num: any): num is number {
    if (typeof num === "number") {
        return num - num === 0;
    }
    if (typeof num === "string" && num.trim() !== "") {
        return Number.isFinite ? Number.isFinite(+num) : isFinite(+num);
    }
    return false;
};

export const readVolatileJSON = <T extends RecursiveReadable = any>(
    fullPath: string,
    options?: {
        createIfNotExists: boolean;
        defaultValue?: T;
    },
): T | null => {
    try {
        if (!fs.existsSync(fullPath)) {
            if (options?.createIfNotExists && options?.defaultValue) {
                fs.mkdirSync(path.dirname(fullPath), { recursive: true });
                fs.writeFileSync(fullPath, JSON.stringify(options.defaultValue, null, 4));
                return options.defaultValue;
            }
            return null;
        }
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            return null;
        }
        return JSON.parse(fs.readFileSync(fullPath, "utf-8"));
    } catch (error: any) {
        return null;
    }
};

const padStart = (string: string, targetLength: number, padString: string): string => {
    targetLength = targetLength >> 0;
    string = String(string);
    padString = String(padString);

    if (string.length > targetLength) {
        return String(string);
    }

    targetLength = targetLength - string.length;

    if (targetLength > padString.length) {
        padString += padString.repeat(targetLength / padString.length);
    }

    return padString.slice(0, targetLength) + String(string);
};

export function validateApproximation(
    value: number | undefined | null,
    sourceValue: number | undefined | null = null,
    minApproximation: number | undefined | null = 0.02,
): number {
    if (sourceValue) {
        if (sourceValue - Number(value) < -0.1) {
            throw {
                statusCode: 403,
                error: {
                    msg: "invalid transaction, treasury total goes below zero",
                },
            };
        }
        if (Math.abs(sourceValue - Number(value)) < Number(minApproximation)) {
            value = sourceValue;
        }
    } else {
        if (Number(value) < -0.1) {
            throw {
                statusCode: 403,
                error: {
                    msg: "invalid transaction, treasury total goes below zero",
                },
            };
        }
        if (Math.abs(Number(value)) < Number(minApproximation)) {
            value = 0;
        }
    }
    return Number(value);
}

const padDate = (n: string, length = 2) => padStart(n, length, "0");
export { padDate, padStart };
/**
 *
 * @param {Date} date
 * @param {Boolean} getdate
 * @param {Boolean} gettime
 * @returns {String}
 */
export function dashDateFormater(
    date: Date,
    getDate: boolean = true,
    getTime: boolean = true,
    getMilliseconds: boolean = false,
): string {
    if (typeof date == "string") {
        date = new Date(date + " ");
    }

    let returnContent: string[] = [];
    if (getDate) {
        const Month = padDate(String(date.getMonth() + 1));
        const DayOfMonth = padDate(String(date.getDate()));
        const FullYear = date.getFullYear();
        returnContent.push(`${FullYear}-${Month}-${DayOfMonth}`);
    }
    if (getTime) {
        const Hour = padDate(String(date.getHours()));
        const Minutes = padDate(String(date.getMinutes()));
        const Seconds = padDate(String(date.getSeconds()));
        let timeString = `${Hour}:${Minutes}:${Seconds}`;
        if (getMilliseconds) {
            const Milliseconds = String(date.getMilliseconds());
            timeString += "." + Milliseconds.padEnd(3, "0");
        }
        returnContent.push(timeString);
    }
    return returnContent.join(" ") + " ";
}

export default {
    cap,
    ObjectManipulation: {
        recursiveSelect: recursiveSelect,
        rs: recursiveSelect,

        selectRandom<T>(arr: T[]): T {
            return arr[Math.floor(arr.length * Math.random())];
        },
    },
    async sleep(time = 1000): Promise<void> {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                resolve();
            }, time);
        });
    },

    selectRandom<T>(arr: T[]): T {
        return arr[Math.floor(arr.length * Math.random())];
    },

    metaUrlToRouterRelativePath(routeUrl: string) {
        const absolutePath = URL.fileURLToPath(routeUrl);
        const routersDirectoryAbsolutePath = path.join(srcPath, routerConfig.getRouterDirectory());
        return path.dirname(absolutePath.slice(routersDirectoryAbsolutePath.length));
    },
    math: math,
};


export const trimSlashes = (path: string) =>
    path == "/"
        ? path
        : path
              .split("/")
              .filter((x) => x)
              .join("/");
