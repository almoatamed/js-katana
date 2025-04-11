import prisma from "$/prisma/client/index.js";
import { HandlerFunction, Requester } from "$/server/utils/express/index.js";
import { NextFunction } from "express";
import { Socket } from "socket.io";
import { userConfig } from "../config/user/index.js";
import User from "../modules/User/index.js";
import ObjectError from "../utils/ObjectError/index.js";

const jwt = (await import("$/server/utils/jwt/index.js")).default;

export type AuthenticatedUser = Requester;

interface AuthOptions {
    allow?: Array<prisma.UserType>;
    reject?: Array<prisma.UserType>;
}

const unauthError = new ObjectError(
    {
        error: { name: "unauthorized", msg: "unauthorized action" },
        statusCode: 401,
    },
    undefined,
    true,
);

type UseTokenOpts = {};

export const useTokenInSocketToGetUser = async (socket: Socket, opts: UseTokenOpts = {}): Promise<prisma.User> => {
    const token = socket.handshake.auth?.token;
    console.log("attempting to authenticate socket connection", socket.handshake);
    if (!token) {
        throw unauthError;
    }
    console.log("user token based on socket", token);
    let userJson: any;
    try {
        userJson = jwt.verify(token);
    } catch (error: any) {
        console.log("user socket token is not valid");
        throw unauthError;
    }

    const userId = Math.floor(userJson.userId);
    const username = userJson.username;
    const user: Requester | null = await User.findFirst(buildFetchUserQuery(userId, username));

    if (!user) {
        throw unauthError;
    }

    const appHeader = socket.handshake.auth["x-app"];
    if (appHeader) {
        const allowedUsersTypes = userConfig.appUserTypesMap(appHeader);
        if (!allowedUsersTypes || !allowedUsersTypes?.includes?.(user.userType)) {
            console.log("socket user app header is not compatible", user.userType, appHeader);
            throw unauthError;
        }
    }

    return user;
};

const authorizeAppHeaderInfo = (request: any, user: prisma.User) => {
    const appHeader = request.headers["x-app"];
    if (appHeader) {
        const allowedUsersTypes = userConfig.appUserTypesMap(appHeader);
        if (!allowedUsersTypes || !allowedUsersTypes?.includes?.(user.userType)) {
            throw unauthError;
        }
    }
};

export const buildFetchUserQuery = (userId?: number, username?: string) => ({
    where: {
        username,
        userId,
        deleted: false,
        active: true,
    },
    include: {
        employmentPosition: {
            include: {
                employee: true,
                department: true,
                authorizationProfile: {
                    include: {
                        profileAuthorities: {
                            where: {
                                deleted: false,
                            },
                            include: {
                                dynamicAuthorities: {
                                    where: {
                                        deleted: false,
                                    },
                                    include: {
                                        dynamicAuthorityValues: {
                                            where: {
                                                deleted: false,
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                authorities: {
                    where: {
                        deleted: false,
                    },
                    include: {
                        dynamicAuthorities: {
                            where: {
                                deleted: false,
                            },
                            include: {
                                dynamicAuthorityValues: {
                                    where: {
                                        deleted: false,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        userAuthorities: {
            where: {
                deleted: false,
            },
            include: {
                dynamicAuthorities: {
                    where: {
                        deleted: false,
                    },
                    include: {
                        dynamicAuthorityValues: {
                            where: {
                                deleted: false,
                            },
                        },
                    },
                },
            },
        },
        authorizationProfile: {
            include: {
                profileAuthorities: {
                    where: {
                        deleted: false,
                    },
                    include: {
                        dynamicAuthorities: {
                            where: {
                                deleted: false,
                            },
                            include: {
                                dynamicAuthorityValues: {
                                    where: {
                                        deleted: false,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
    },
});

export const useTokenInReqToGetUser = async (request): Promise<prisma.User> => {
    const token = request.headers["authorization"];
    if (!token) {
        throw unauthError;
    }
    let userJson: any;
    userJson = jwt.verify(token);

    const user = await User.findFirst(buildFetchUserQuery(userJson.userId, userJson.username));

    if (!user) {
        throw unauthError;
    }

    authorizeAppHeaderInfo(request, user);

    return user;
};

function createHandler(options?: AuthOptions) {
    const handler: HandlerFunction = async (req, _, next) => {
        try {
            const opt = options || {};
            req.user = (await useTokenInReqToGetUser(req)) as any;

            let condition: boolean = true;

            if (opt.allow) {
                condition &&= !!opt.allow.some((userType) => req.user.userType == userType);
            }

            if (opt.reject) {
                condition &&= !opt.reject.some((userType) => req.user.userType == userType);
            }

            if (condition) {
                return next();
            }

            throw unauthError;
        } catch (error: any) {
            next(error);
        }
    };
    return handler;
}

const obj = {
    /**
     *
     *
     * @param {AuthOptions|import("../utils/express/index.js").Req} [options]
     * @param {*} [res]
     * @param {*} [next]
     *
     *
     * @returns {} nothing || Function middleware
     *
     * @example
     *
     * router.post(userMiddleware.auth, (req,res,next)=>{
     *   // some code
     * })
     * // OR
     * router.pose((await userMiddleware.auth({rejectAdmin:true, allow:['cto', 'ceo']})), (req,res,next)=>{
     *   // some code
     * })
     *
     */
    auth: async function authenticate(
        options: AuthOptions | import("../utils/express/index.js").Req,
        res: any,
        next: NextFunction,
    ): Promise<HandlerFunction | void> {
        if (arguments.length == 1) {
            return createHandler(arguments[0]);
        }

        const req = arguments[0];
        const handler = createHandler();
        await handler(req, res, next);
    },
};

export default obj;
