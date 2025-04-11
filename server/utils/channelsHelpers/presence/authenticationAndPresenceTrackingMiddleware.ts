import { Socket } from "socket.io";
import { AuthenticatedUser, useTokenInSocketToGetUser } from "../../../middlewares/user.middleware.js";
import { client } from "../../../modules/index.js";
import {
    addUserPresenceDetails,
    removeUserPresenceDetails,
    selectUserPresence,
    startCallKiller,
} from "./state.js";


import logger from "$/server/utils/log/index.js";

const log = await logger("user presence tracker", "green", true, "Info")

type SocketInstance = Socket<any, any, any, any>;

const isMiddlewareRejected = (middlewareResult: any) => {
    return middlewareResult === false || typeof middlewareResult == "string";
};

const extractScope = (socket: SocketInstance) => {
    const scope: string | undefined = socket.handshake.auth?.["x-app"] || socket.handshake.auth?.["x-scope"];
    return scope;
};

const validateScopeParameter = (scope: string | undefined, requiredScope: string) => {
    if (scope != requiredScope) {
        if (scope) {
            return "region Access 'x-app' parameter is not for this section of the api";
        } else {
            return "region Access 'x-app' parameter is not provided in auth data";
        }
    }
};

const authenticateSocket = async (socket: SocketInstance) => {
    try {
        const user = await useTokenInSocketToGetUser(socket);
        if (user) {
            socket.data.user = user;
        } else {
            return "user not found";
        }
    } catch (error: any) {
        log(error);
        return error.error.msg || error.msg || error.message || "unauthenticated user";
    }
};

const registerPresence = async (socket: SocketInstance) => {
    try {
        const User = {...socket.data.user as AuthenticatedUser};
        const user = {
            ...User, 
            username: ((User as any).userName || (User as any).username ) as string,
            userName: ((User as any).userName || (User as any).username ) as string,
            name: ((User as any).name || (User as any).fullName ) as string,
            fullName: ((User as any).name || (User as any).fullName ) as string,
            userType: (User as any).role || (User as any).userType,
            role: (User as any).role || (User as any).userType,
            
        }
       
        const userCurrentPresence = await selectUserPresence(user.userId);
        if (
            !userCurrentPresence?.socketIds.find((sid) => {
                sid == socket.id;
            })
        ) {
            const connectTime = new Date();
            const wasOffline = !userCurrentPresence?.socketIds?.length;



            if (wasOffline) {
                await client.user.update({
                    where: {
                        userId: socket.data.user.userId,
                    },
                    data: {
                        lastOnline: connectTime,
                    },
                });
            }

            await addUserPresenceDetails(
                {
                    userId: user.userId,
                    username: (user as any).userName || (user as any).username,
                    userType: (user as any).role || (user as any).userType,
                    email: user.email,
                    phone: user.phone,
                    fullName: (user as any).name || (user as any).fullName,
                },
                socket.id,
            );

            socket.to("user-presence").emit("user-presence:connected", {
                socketId: socket.id,
                userId: user.userId,
                wasOffline,
                currentConnectedSocket: userCurrentPresence?.socketIds || [],
                connectTime: connectTime,
                username: (user as any).userName || (user as any).username,
                userType: (user as any).role ||(user as any).userType,
                email: user.email,
                phone: user.phone,
                    fullName: (user as any).name || (user as any).fullName,
            });
            socket
                .to(`user-presence:${user.userId}`)
                .emit(`user-presence:${user.userId}:connected`, await selectUserPresence(user.userId));

            socket.join(`user:${user.userId}`);
            log("connected", { username: (user as any).userName || (user as any).username, userId: user.userId, socketId: socket.id, wasOffline });

            socket.on("disconnect", async () => {
                await removeUserPresenceDetails(user, socket.id);
                const currentUserPresence = await selectUserPresence(user.userId);
                const disconnectTime = new Date();
                const stillOnline = !!currentUserPresence?.socketIds.length;
                if (!stillOnline) {
                    await client.user.update({
                        where: {
                            userId: socket.data.user.userId,
                        },
                        data: {
                            // @ts-ignore
                            lastOffline: disconnectTime,
                        },
                    });
                }

                startCallKiller(socket.id);

                socket.to("user-presence").emit("user-presence:disconnected", {
                    socketId: socket.id,
                    stillOnline,
                    disconnectTime,
                    userId: user.userId,
                    currentConnectedSockets: currentUserPresence?.socketIds || [],
                });
                socket.to(`user-presence:${user.userId}`).emit(`user-presence:${user.userId}:disconnected`, {
                    socketId: socket.id,
                    stillOnline,
                    disconnectTime,
                    userId: user.userId,
                    currentConnectedSockets: currentUserPresence?.socketIds || [],
                });

                log("disconnected", { username: user.username, userId: user.userId, socketId: socket.id, stillOnline });
            });
        }
    } catch (error: any) {
        log(error);
        return false;
    }
};

export const createScopingAndPresenceTrackingChannelsMiddleware = (props: {
    requiredScope: string | undefined;
}) => {
    return async (socket: SocketInstance) => {
        const scope = extractScope(socket);

        if (props.requiredScope) {
            const result = validateScopeParameter(scope, props.requiredScope);
            if (isMiddlewareRejected(result)) {
                log.warning("socket scope is not valid", scope, props.requiredScope, result)
                return result;
            }
        }
        
        const authenticationResult = await authenticateSocket(socket);
        if (isMiddlewareRejected(authenticationResult)) {
            log.warning("socket failed to authenticate", authenticationResult)
            return authenticationResult;
        }

        const registrationResult = await registerPresence(socket);
        log.warning(registrationResult === false ? "presence registration failed" : "presence registered" , "for socket", socket.data.user?.username)
        return registrationResult;
    };
};
