import { UserSocketDetails } from "$/server/utils/channelsHelpers/presence/state.js";

export type roomType = "personal" | "group";

export type Room = {
    roomId?: number | string;
    name: string;
    roomType: roomType;
    members: UserSocketDetails["user"][];
    lastUpdated?: Date;
    lastMessage?: Message;
};

export type MessageReaction = {
    reaction: "laugh" | "wow" | "sad" | "thumbsUp" | "love" | "highFive";
    userId: number;
    createdAt: string | Date;
};

export type MessageType = "typing" | "text" | "voiceMessage" | "fileAttachment" | "image" | "video";

export type Message = {
    text: string;
    pushed: boolean;
    messageType: MessageType;
    reactions?: MessageReaction[];
    fileId?: number;
    imageId?: number;
    videoId?: number;
    user: UserSocketDetails["user"];
    createdAt: string | Date;
    status: "sent" | "sending" | "failed";
    receivedBy: {
        userId: number;
        createdAt: number;
    }[];
    seenBy: {
        userId: number;
        createdAt: number;
    }[];
};

export const createPersonalRoomName = (members: Room["members"]) => {
    return members
        .map((m) => m.userId.toString())
        .sort()
        .join("-");
};
