import url from "url";
import xmlrpc from "xmlrpc";
import { useApi } from "../../../../useApi/index.js";

type OdooXmlrpcAdapterProps = {
    url: string;
    port?: number;
    db: string;
    username: string;
    password: string;
    secure?: boolean;
};

export type OdooMethod =
    | "search"
    | "read"
    | "searchRead"
    | "create"
    | "write"
    | "unlink"
    | "fieldsGet"
    | "nameGet"
    | "nameSearch"
    | "defaultGet";
export const createOdooXmlrpcClient = function (config: OdooXmlrpcAdapterProps) {
    config = config || {};

    const urlParts = url.parse(config.url);
    const host = urlParts.hostname as string;
    const port = (config.port || urlParts.port) as number;
    const db = config.db;
    const username = config.username;
    const password = config.password;
    const secure = config.secure === undefined ? urlParts.protocol == "https:" : config.secure;

    const connectionParameters = {
        urlParts,
        host,
        port,
        db,
        username,
        password,
        secure,
    };

    let commonClient: xmlrpc.Client;
    const commonClientOptions = {
        host: host,
        port: port,
        path: "/xmlrpc/2/common",
    };
    if (secure == false) {
        commonClient = xmlrpc.createClient(commonClientOptions);
    } else {
        commonClient = xmlrpc.createSecureClient(commonClientOptions);
    }

    let objectClient: xmlrpc.Client;
    const objectClientOptions = {
        host: host,
        port: port,
        path: "/xmlrpc/2/object",
    };
    if (secure == false) {
        objectClient = xmlrpc.createClient(objectClientOptions);
    } else {
        objectClient = xmlrpc.createSecureClient(objectClientOptions);
    }

    const connect = async function (): Promise<number> {
        return new Promise((resolve, reject) => {
            const params = [] as any[];
            params.push(db);
            params.push(username);
            params.push(password);
            params.push({});
            commonClient.methodCall("authenticate", params, function (error, value) {
                if (error) {
                    return reject(error);
                }
                if (!value) {
                    return reject({ message: "No UID returned from authentication." });
                }
                return resolve(value);
            });
        });
    };

    const apiWrapper = useApi({
        login: connect,
    });
    const version = function (): Promise<any> {
        return new Promise((resolve, reject) => {
            commonClient.methodCall("version", [], (error, value) => {
                if (error) {
                    return reject(error);
                } else {
                    return resolve(value);
                }
            });
        });
    };
    const executeKw = function ({
        model,
        method,
        params = [],
    }: {
        model?: any;
        method: OdooMethod;
        params?: string | any[];
    }): Promise<any> {
        return apiWrapper.use(async (uid) => {
            return new Promise((resolve, reject) => {
                const fParams = [] as any[];
                fParams.push(db);
                fParams.push(uid);
                fParams.push(password);
                if (model) {
                    fParams.push(model);
                }
                fParams.push(method);
                for (let i = 0; i < params.length; i++) {
                    fParams.push(params[i]);
                }
                objectClient.methodCall("executeKw", fParams, function (error: any, value: any) {
                    if (error) {
                        return reject(error);
                    }
                    return resolve(value);
                });
            });
        });
    };
    const execWorkflow = function (model: any, method: any, params: string | any[]): Promise<any> {
        return apiWrapper.use(async (uid) => {
            return new Promise((resolve, reject) => {
                const fParams = [] as any[];
                fParams.push(db);
                fParams.push(uid);
                fParams.push(password);
                fParams.push(model);
                fParams.push(method);
                for (let i = 0; i < params.length; i++) {
                    fParams.push(params[i]);
                }
                objectClient.methodCall("execWorkflow", fParams, function (error: any, value: any) {
                    if (error) {
                        return reject(error);
                    }
                    return resolve(value);
                });
            });
        });
    };
    const renderReport = function (report: any, params: string | any[]): Promise<any> {
        return apiWrapper.use(async (uid) => {
            return new Promise((resolve, reject) => {
                const fParams = [] as any[];
                fParams.push(db);
                fParams.push(uid);
                fParams.push(password);
                fParams.push(report);
                for (let i = 0; i < params.length; i++) {
                    fParams.push(params[i]);
                }
                objectClient.methodCall("renderReport", fParams, function (error: any, value: any) {
                    if (error) {
                        return reject(error);
                    }
                    return resolve(value);
                });
            });
        });
    };

    return {
        execWorkflow,
        executeKw,
        connect,
        renderReport,
        version,
        connectionParameters,
        apiWrapper,
    };
};
