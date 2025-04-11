import { ChannelHandlerBuilder } from "../utils/channelsBuilder/index.js";

const handler: ChannelHandlerBuilder = (socket) => {
    return [
        (body, cb) => {
            cb?.(body);
        },
    ];
};
export default handler;
