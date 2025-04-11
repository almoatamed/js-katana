import logger from "$/server/utils/log/index.js";
import { BroadcastOperator, Server, Socket } from "socket.io";
import { client } from "../../../../modules/index.js";
import { io } from "../../../channelsBuilder/index.js";
import { makeThreadedJson } from "../../../dynamicJson/threadedJson.js";

type Props<
    HandShakeQueryInfo extends Record<string, any>,
    TrackedRecordType extends Record<string, any>,
    AdditionalState extends Record<string, any> | null = null,
    RecordSocket = SocketInstance<
        {
            record: TrackedRecordType;
        },
        HandShakeQueryInfo
    >,
    RecordSocketDetails = {
        record: TrackedRecordType;
        socketsIds: string[];
    },
    RecordsData = Record<string, RecordSocketDetails>,
    State = {
        data: RecordsData;
    } & (AdditionalState extends null ? {} : AdditionalState),
> = {
    id: string;
    lastOnlineKey: string;
    lastOfflineKey: string;
    recordModelIdKey: string;
    model: import("$/server/utils/JsDoc/assets/models.js").Model;
    authenticate?: (socket: RecordSocket) => void | Promise<void>;
    getRecord: (socket: RecordSocket) => Promise<null | TrackedRecordType>;
    registerRecord?: (socket: RecordSocket) => Promise<TrackedRecordType>;
    onRecordSocketConnect?: (socket: RecordSocket) => void | Promise<void>;
    onRecordSocketDisconnect?: (socket: RecordSocket) => void | Promise<void>;
} & (AdditionalState extends null
    ? {}
    : {
          initialState: () => AdditionalState | Promise<AdditionalState>;
      });

type SocketInstance<Data, Query> = Omit<Socket<any, any, any, Data>, "handshake"> & {
    handshake: Omit<Socket<any, any, any, Data>["handshake"], "query"> & {
        query: Query;
    };
};

export const createPresenceTracker = async <
    HandShakeQueryInfo extends Record<string, any>,
    TrackedRecordType extends Record<string, any>,
    AdditionalState extends Record<string, any> | null,
>(
    props: Props<HandShakeQueryInfo, TrackedRecordType, AdditionalState>,
) => {
    const log = await logger(`${props.id} presence tracker`, "green", true, "Info");

    type RecordSocket = SocketInstance<
        {
            record: TrackedRecordType;
        },
        HandShakeQueryInfo
    >;

    const isMiddlewareRejected = (middleWareResult: any) => {
        return middleWareResult === false || typeof middleWareResult == "string";
    };

    const extractScope = (socket: RecordSocket) => {
        const scope: string | undefined = socket.handshake.auth?.["x-app"] || socket.handshake.auth?.["x-scope"];
        return scope;
    };

    const validateScopeParamter = (scope: string | undefined, requiredScope: string) => {
        if (scope != requiredScope) {
            if (scope) {
                return "region Access 'x-app' parameter is not for this section of the api";
            } else {
                return "region Access 'x-app' parameter is not provided in auth data";
            }
        }
    };

    const authenticateSocket = async (socket: RecordSocket) => {
        try {
            await props.authenticate?.(socket);
        } catch (error: any) {
            log(error);
            return error.error.msg || error.msg || error.message || "unauthenticated record";
        }
    };

    type RecordSocketDetails = {
        record: TrackedRecordType;
        socketsIds: string[];
    };
    type RecordsData = Record<string, RecordSocketDetails>;
    type State = {
        data: RecordsData;
    } & (AdditionalState extends null ? {} : AdditionalState);

    const initialRecordsState: State = {
        data: {} as RecordsData,
        ...(await (props as any).initialState()),
    };

    const recordsState = await makeThreadedJson(initialRecordsState, {
        uniqueEventNumber: props.id,
        broadcastOnUpdate: false,
        lazy: true,
    });

    const selectRecordPresence = async (
        id: number | string,
        data: RecordsData | undefined = undefined,
    ): Promise<RecordSocketDetails | undefined> => {
        if (!data) {
            return await recordsState.get(["data", id.toString()]);
        } else {
            return data[id];
        }
    };

    const addRecordPresenceInfo = async (record: TrackedRecordType, socketId: string) => {
        const oldRecordPresenceInfo = await selectRecordPresence(record[props.recordModelIdKey]);
        if (oldRecordPresenceInfo) {
            await recordsState.push(["data", record[props.recordModelIdKey].toString(), "socketIds"], socketId);
        } else {
            await recordsState.set("data", record[props.recordModelIdKey].toString(), {
                record: record,
                socketsIds: [socketId],
            } as RecordSocketDetails);
        }
    };

    const sendEventToRecord = async (options: {
        recordId: number | string;
        event: string;
        message: any;
        cb?: (err: any, response: any) => any;
        timeout?: number;
    }) => {
        const recordPresence = await selectRecordPresence(options.recordId);
        if (recordPresence?.socketsIds?.length) {
            if (io) {
                let query: BroadcastOperator<any, any> | Server<any, any, any, any>;
                if (options.timeout && options.cb) {
                    query = io.timeout(options.timeout);
                } else {
                    query = io;
                }
                if (options.cb) {
                    query.to(recordPresence.socketsIds).emit(options.event, options.message, options.cb);
                } else {
                    query.to(recordPresence.socketsIds).emit(options.event, options.message);
                }
                return true;
            }
        }
        return false;
    };

    const removeRecordPresenceDetails = async (record: TrackedRecordType, socketId: string) => {
        const oldPresenceInfo = await selectRecordPresence(record.recordId);
        if (oldPresenceInfo) {
            await recordsState.removeItemFromArray(["data", record.recordId.toString(), "socketIds"], socketId);
        }
    };

    const registerPresence = async (socket: RecordSocket) => {
        try {
            let record: TrackedRecordType | null = await props.getRecord(socket);
            if (!record) {
                if (props.registerRecord) {
                    record = await props.registerRecord(socket);
                } else {
                    const msg = `Record Not found for ${props.id} in presence registration process ${socket.handshake.query}`;
                    log.warning(msg);
                    return msg;
                }
            }

            socket.data.record = record;

            const recordCurrentPresence = await selectRecordPresence(record[props.recordModelIdKey]);

            if (
                !recordCurrentPresence?.socketsIds.find((sid) => {
                    sid == socket.id;
                })
            ) {
                const currentTime = new Date();
                const wasOffline = !recordCurrentPresence?.socketsIds?.length;

                if (wasOffline) {
                    await (client as any)[props.model].update({
                        where: {
                            [props.recordModelIdKey]: socket.data.record[props.recordModelIdKey],
                        },
                        data: {
                            [props.lastOnlineKey]: currentTime,
                        },
                    });
                }

                await addRecordPresenceInfo(record, socket.id);

                socket.to(`${props.id}-record-presence`).emit(`${props.id}-record-presence:connected`, {
                    wasOffline,
                    connectTime: currentTime,

                    socketId: socket.id,
                    recordId: record[props.recordModelIdKey],
                    currentConnectedSocketsIds: recordCurrentPresence?.socketsIds || [],
                    record,
                });
                socket
                    .to(`${props.id}-record-presence:${record[props.recordModelIdKey]}`)
                    .emit(
                        `${props.id}-record-presence:${record[props.recordModelIdKey]}:connected`,
                        await selectRecordPresence(record[props.recordModelIdKey]),
                    );

                socket.join(`${props.id}-record:${record[props.recordModelIdKey]}`);
                log(props.id, "connected", {
                    recordId: record[props.recordModelIdKey],
                    socketId: socket.id,
                    wasOffline,
                });
                await props.onRecordSocketConnect?.(socket);
                socket.on("disconnect", async () => {
                    await removeRecordPresenceDetails(record, socket.id);
                    const currentRecordPresence = await selectRecordPresence(record[props.recordModelIdKey]);
                    const disconnectTime = new Date();
                    const stillOnline = !!currentRecordPresence?.socketsIds.length;
                    if (!stillOnline) {
                        await (client as any)[props.model].update({
                            where: {
                                [props.recordModelIdKey]: socket.data.record[props.recordModelIdKey],
                            },
                            data: {
                                [props.lastOfflineKey]: disconnectTime,
                            },
                        });
                    }

                    await props.onRecordSocketDisconnect?.(socket);

                    socket.to(`${props.id}-record-presence`).emit(`${props.id}-record-presence:disconnected`, {
                        stillOnline,
                        disconnectTime,
                        socketId: socket.id,
                        recordId: record[props.recordModelIdKey],
                        currentConnectedSocketsIds: recordCurrentPresence?.socketsIds || [],
                        record,
                    });
                    socket
                        .to(`${props.id}-record-presence:${record[props.recordModelIdKey]}`)
                        .emit(`${props.id}-record-presence:${record[props.recordModelIdKey]}:disconnected`, {
                            socketId: socket.id,
                            stillOnline,
                            disconnectTime,
                            recordId: record[props.recordModelIdKey],
                            currentConnectedSockets: currentRecordPresence?.socketsIds || [],
                        });

                    log(props.id, "disconnected", {
                        recordId: record[props.recordModelIdKey],
                        socketId: socket.id,
                        stillOnline,
                    });
                });
            }
        } catch (error: any) {
            log(error);
            return false;
        }
    };

    const createScopingAndPresenseTrackingMiddleware = (middleWareProps?: { requiredScope?: string }) => {
        return async (socket: RecordSocket) => {
            const scope = extractScope(socket);

            if (middleWareProps?.requiredScope) {
                const result = validateScopeParamter(scope, middleWareProps.requiredScope);
                if (isMiddlewareRejected(result)) {
                    log.warning("socket scope is not valid", result);
                    return result;
                }
            }

            const authenticationResult = await authenticateSocket(socket);
            if (isMiddlewareRejected(authenticationResult)) {
                log.warning("socket failed to authenticate", authenticationResult);
                return authenticationResult;
            }

            const registrationResult = await registerPresence(socket);
            log.warning(
                registrationResult === false ? "presence registration failed" : "presence registered",
                props.id,
                "for socket",
                socket.data.record,
            );
            return registrationResult;
        };
    };

    return {
        sendEventToRecord,
        createScopingAndPresenseTrackingMiddleware,
    };
};
