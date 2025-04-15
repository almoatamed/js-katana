import { Prisma } from "$/prisma/client/index.js";
import User from "../../modules/User/index.js";


import * as prisma from "$/prisma/client/index.js";
import { Router } from "express";
import Modules from "../../modules/index.js";
const _Modules = Modules;

import { NestedType, surfaceNestedType } from "../common/index.js";
const express = (await import("express")).default;

export type RequesterArgs = Prisma.Args<typeof User, "findFirst">;
export type RequesterFull = Prisma.Payload<typeof User, "findFirst">;
export type Requester = prisma.Prisma.UserGetPayload<{
    include: {
        employmentPosition: {
            include: {
                employee: true;
                department: true;
                authorizationProfile: {
                    include: {
                        profileAuthorities: {
                            where: {
                                deleted: false;
                            };
                            include: {
                                dynamicAuthorities: {
                                    where: {
                                        deleted: false;
                                    };
                                    include: {
                                        dynamicAuthorityValues: {
                                            where: {
                                                deleted: false;
                                            };
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
                authorities: {
                    where: {
                        deleted: false;
                    };
                    include: {
                        dynamicAuthorities: {
                            where: {
                                deleted: false;
                            };
                            include: {
                                dynamicAuthorityValues: {
                                    where: {
                                        deleted: false;
                                    };
                                };
                            };
                        };
                    };
                };
            };
        };
        userAuthorities: {
            where: {
                deleted: false;
            };
            include: {
                dynamicAuthorities: {
                    where: {
                        deleted: false;
                    };
                    include: {
                        dynamicAuthorityValues: {
                            where: {
                                deleted: false;
                            };
                        };
                    };
                };
            };
        };
        authorizationProfile: {
            include: {
                profileAuthorities: {
                    where: {
                        deleted: false;
                    };
                    include: {
                        dynamicAuthorities: {
                            where: {
                                deleted: false;
                            };
                            include: {
                                dynamicAuthorityValues: {
                                    where: {
                                        deleted: false;
                                    };
                                };
                            };
                        };
                    };
                };
            };
        };
    };
}>;

export type Req = import("express").Request & {
    user: Requester;
    fingerprint?: {
        hash: string;
    };
    Modules: typeof Modules;
    client: typeof Modules;
};
type ApiType = "Socket" | "Http";

export type R = {
    isRouter: true;
    servedTypes: ApiType[];
    events: {
        [key: string]:
            | undefined
            | {
                  path: string;
                  handlers: HandlerFunction[];
              };
    };
    middlewares: HandlerFunction[];
    children: {
        [key: string]: { path: string | false; router: R };
    };
    directoryFullPath?: string;
    routeFullPath?: string;
} & {
    pushMiddlewares: (...handler: Handler[]) => void;
    post: (path: string, ...handler: Array<Handler>) => any;
    get: (path: string, ...handler: Array<Handler>) => any;
    all: (path: string, ...handler: Array<Handler>) => any;
    put: (path: string, ...handler: Array<Handler>) => any;
    delete: (path: string, ...handler: Array<Handler>) => any;
    use: (path: string | Handler | R, ...handlers: (Handler | R)[]) => any;
    useAndPushToMiddlewares: (path: string | Handler | R, ...handlers: (Handler | R)[]) => any;
    _Router: Router;
};

export type HandlerFunction = (
    request: Req,
    response: import("express").Response,
    next: import("express").NextFunction,
) => any;
type Handler = NestedType<HandlerFunction>;

export type toBeOmitted = { Router: (typeof express)["Router"] };
export type ExpressInterface = (Omit<typeof express, "Router"> & {
    Router: () => R;
    __Router: (typeof express)["Router"];
}) &
    typeof express;

const expressInterface: ExpressInterface = express as any;

type UseProp = NestedType<R | HandlerFunction>;

type HttpMethodName = "post" | "get" | "delete" | "put" | "all";

const routeModifier = function (methodName: HttpMethodName, routerInstance: R) {
    return (path: string, ...handlers: Handler[]) => {
        const surfacedHandlers = surfaceNestedType<HandlerFunction>(handlers);

        // modify handlers to
        const modifiedHandlers: HandlerFunction[] = [];
        for (const handler of surfacedHandlers) {
            modifiedHandlers.push(async (request, response, next) => {
                try {
                    return await handler(request, response, next);
                } catch (error: any) {
                    next(error);
                }
            });
        }
        if (routerInstance.servedTypes.includes("Socket")) {
            const foundEvent = routerInstance.events[path];
            if (!foundEvent) {
                routerInstance.events[path] = {
                    path,
                    handlers: modifiedHandlers,
                };
            }
        }
        // call original method with args
        routerInstance._Router[methodName](path, ...(modifiedHandlers as any));
    };
};

const useModifier = function (routerInstance: R, pushToMiddlewares = false) {
    return (path: UseProp | string, ...handlers: UseProp[]) => {
        const firstItem = path;
        let prefix: false | string = false;
        if (typeof firstItem == "string") {
            prefix = firstItem;
        } else {
            handlers.unshift(firstItem);
        }

        const surfacedProps = surfaceNestedType(handlers);
        const modifiedProps: (HandlerFunction | R["_Router"])[] = [];

        for (const item of surfacedProps) {
            if (typeof item == "function") {
                pushToMiddlewares && routerInstance.middlewares.push(item);
                modifiedProps.push(item);
            } else {
                item.middlewares.unshift(...modifiedProps.filter((i) => typeof i === "function"));
                routerInstance.children[prefix || "/"] = {
                    path: prefix,
                    router: item,
                };
                modifiedProps.push(item._Router);
            }
        }
        if (prefix) {
            routerInstance._Router.use(prefix, modifiedProps as any);
        } else {
            routerInstance._Router.use(modifiedProps as any);
        }
    };
};

expressInterface.__Router = expressInterface.Router;
const modifyRouter = () => {
    (expressInterface as any).Router = function () {
        const _Router = expressInterface.__Router();
        const router: R = {
            children: {},
            servedTypes: ["Http", "Socket"],
            events: {},
            isRouter: true,
            _Router: _Router,
            pushMiddlewares(...handler) {
                const surfacedHandlers = surfaceNestedType(handler);
                this.middlewares.push(...surfacedHandlers);
            },
            useAndPushToMiddlewares: () => {},
            all: () => {},
            post: () => {},
            delete: () => {},
            put: () => {},
            get: () => {},
            middlewares: [],
            use: () => {},
        };

        const methods: HttpMethodName[] = ["all", "put", "delete", "get", "post"];

        for (const method of methods) {
            router[method] = routeModifier(method, router);
        }
        router.use = useModifier(router);
        router.useAndPushToMiddlewares = useModifier(router, true);
        return router;
    };
};
modifyRouter();

export const clientModifierMiddleware: HandlerFunction = (request, response, next) => {
    const Modules: any = {};
    if (request.fingerprint) {
        for (const key in _Modules) {
            if (typeof _Modules[key] == "function") {
                Modules[key] = _Modules[key];
            } else if (_Modules[key]?.findFirst) {
                Modules[key] = { ..._Modules[key] };
                if (_Modules[key]?.findFirst) {
                    (Modules as any)[key].findFirst = async (props: any) => {
                        return (_Modules as any)[key].findFirst({
                            ...(props || {}),
                            fingerprint: request.fingerprint?.hash,
                        });
                    };
                }
                if (_Modules[key]?.findMany) {
                    (Modules as any)[key].findMany = async (props: any) => {
                        return (_Modules as any)[key].findMany({
                            ...(props || {}),
                            fingerprint: request.fingerprint?.hash,
                        });
                    };
                }
                if (_Modules[key]?.findUnique) {
                    (Modules as any)[key].findUnique = async (props: any) => {
                        return (_Modules as any)[key].findUnique({
                            ...(props || {}),
                            fingerprint: request.fingerprint?.hash,
                        });
                    };
                }
            }
        }
    }
    (request as any).Modules = Modules;
    (request as any).client = Modules;
    next();
};

export default expressInterface;
