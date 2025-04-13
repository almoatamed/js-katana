import client from "$/server/modules/index.js";
import { io } from "$/server/utils/channelsBuilder/index.js";
import makeThreadedJson from "$/server/utils/dynamicJson/threadedJson.js";
import { BroadcastOperator, Server } from "socket.io";
export type UserInfo = {
    userId: number;
    username: string;
    userType: string;
    email: string | undefined | null;
    phone: string | undefined | null;
    fullName: string;
};

export type UserSocketDetails = {
    user: UserInfo;
    socketIds: string[];
};

type UsersData = Record<string, UserSocketDetails>;

export type RoomData = {
    callCurrentUsers: {
        userId: number;
        socketId: string;
    }[];
    callType: null | "video" | "voice";
    callId: null | string;
    usersJoinedCall: number | null;
    usersRejectedCall: number | null;
    countOfNotifiedUsersWhenCallStarted: number | null;
};
type RoomsData = Record<number, RoomData>;

const initialUsersSocketsState = {
    data: {} as UsersData,
    rooms: {} as RoomsData,
};

const usersSocketsState = await makeThreadedJson(initialUsersSocketsState, {
    lazy: true,
    uniqueEventId: "usersSocketState",
    broadcastOnUpdate: false,
});

export const selectUserPresence = async (
    id: number,
    data: UsersData | undefined = undefined,
): Promise<UserSocketDetails | undefined> => {
    if (!data) {
        return await usersSocketsState.get(["data", id.toString()]);
    } else {
        return data[id];
    }
};
export const getUsersData = async (): Promise<UsersData> => {
    return await usersSocketsState.get(["data"]);
};

export const getRoomSocketIds = async (
    roomId: number,
    options?: {
        excludeUserIds?: number[];
    },
) => {
    // @ts-ignore
    const room = await client.messagingRooms.findFirst({
        where: {
            deleted: false,
            roomId: Number(roomId),
        },
        select: {
            members: {
                select: {
                    userId: true,
                },
                where: {
                    deleted: false,
                    user: {
                        active: true,
                        deleted: false,
                    },
                },
            },
        },
    });
    const socketIds = [] as string[];
    if (room?.members?.length) {
        const usersPresenceInfo = await getUsersData();
        for (const member of room.members) {
            if (member.userId) {
                if (options?.excludeUserIds?.find((uId) => uId == member.userId)) {
                    continue;
                }
                const userSocketData = usersPresenceInfo[member.userId];
                if (userSocketData?.socketIds?.length) {
                    socketIds.push(...userSocketData.socketIds);
                }
            }
        }
    }
    return socketIds;
};

export const joinCall = async (roomId: number, userId: number, socketId: string) => {
    const roomData = await getRoomData(roomId);
    if (roomData?.callCurrentUsers?.length) {
        const foundUser = roomData.callCurrentUsers.find((f) => {
            return f.userId == userId;
        });
        if (!foundUser) {
            await usersSocketsState.push(["rooms", String(roomId), "callCurrentUsers"], {
                userId: userId,
                socketId: socketId,
            });
            await usersSocketsState.set(
                ["rooms", String(roomId)],
                "usersJoinedCall",
                Number(roomData.usersJoinedCall) + 1,
            );
            return {
                newJoin: true,
            };
        }
    }
    return null;
};

export const leaveCall = async (roomId: number, socketId: string) => {
    const roomData = await getRoomData(roomId);
    if (roomData?.callCurrentUsers.length) {
        const foundUser = roomData.callCurrentUsers.find((u) => u.socketId == socketId);
        if (foundUser) {
            await usersSocketsState.removeItemFromArray(
                ["rooms", String(roomId), "callCurrentUsers"],
                foundUser,
                "socketId",
            );
            const callEnded = roomData.callCurrentUsers.length <= 2;
            return {
                callEnded,
                callType: roomData.callType,
                callId: roomData.callId,
                userId: foundUser.userId,
                socketId: foundUser.socketId,
            };
        }
    }
    return null;
};

export const getUserData = selectUserPresence;

export const sendEventToUser = async (options: {
    userId: number;
    event: string;
    message: any;
    cb?: (err: any, response: any) => any;
    timeout?: number;
}) => {
    const userPresence = await selectUserPresence(options.userId);
    if (userPresence?.socketIds?.length) {
        if (io) {
            let query: BroadcastOperator<any, any> | Server<any, any, any, any>;
            if (options.timeout && options.cb) {
                query = io.timeout(options.timeout);
            } else {
                query = io;
            }
            if (options.cb) {
                query.to(userPresence.socketIds).emit(options.event, options.message, options.cb);
            } else {
                query.to(userPresence.socketIds).emit(options.event, options.message);
            }
            return true;
        }
    }
    return false;
};

export const getRoomData = async (roomId: number) => {
    const room: RoomData | undefined = await usersSocketsState.get(["rooms", String(roomId)]);
    return room;
};

export const getRoomsData = async () => {
    const result: RoomsData = await usersSocketsState.get("rooms");
    return result;
};

export const startCallKiller = async (socketId: string) => {
    try {
        const userOngoingCalls = await getSocketOngoingCalls(socketId);
        if (userOngoingCalls.length) {
            for (const roomId of userOngoingCalls) {
                await leaveCall(Number(roomId), socketId);
            }
        }
    } catch (error: any) {
        console.log(error);
    }
};
export const getSocketOngoingCalls = async (socketId: string) => {
    const rooms = await getRoomsData();
    const ongoingCalls = [] as number[];
    for (const roomId in rooms) {
        if (rooms[roomId]?.callCurrentUsers?.find((u) => socketId == u.socketId)) {
            ongoingCalls.push(Number(roomId));
        }
    }
    return ongoingCalls;
};

export const addUserPresenceDetails = async (user: UserInfo, socketId: string) => {
    const oldPresenceInfo = await selectUserPresence(user.userId);
    if (oldPresenceInfo) {
        await usersSocketsState.push(["data", user.userId.toString(), "socketIds"], socketId);
    } else {
        await usersSocketsState.set("data", user.userId.toString(), {
            user: user,
            socketIds: [socketId],
        } as UserSocketDetails);
    }
};

export const removeUserPresenceDetails = async (user: UserInfo, socketId: string) => {
    const oldPresenceInfo = await selectUserPresence(user.userId);
    if (oldPresenceInfo) {
        await usersSocketsState.removeItemFromArray(["data", user.userId.toString(), "socketIds"], socketId);
    }
};

export default usersSocketsState;
export { usersSocketsState };
