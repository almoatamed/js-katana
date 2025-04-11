import client from "../../../../../utils/database/prisma.js";
import { Requester } from "../../../../../utils/express/index.js";
import multirules from "../../../../../utils/rules/multirules.js";
import requesterFields from "../../../../utils/requesterFields/index.js";

type Options = {
    requester: Requester;
    notificationIds: number[];
    read: boolean;
};
export async function changeNotificationStatus(options: Options) {
    await multirules([
        [
            ["required", "array"],
            options.notificationIds,
            "Notification ID's",
            {
                array: ["number"],
            },
        ],
        [["required", "boolean"], options.read, "Read status"],
    ]);

    for (const notificationId of options.notificationIds) {
        await multirules([
            [
                ["required", "number", "exists"],
                notificationId,
                "Notification ID",
                { number: { min: 0 }, exists: { model: "userNotification", idKey: "notificationId", parseInt: true } },
            ],
        ]);
    }

    return await client.userNotification.updateMany({
        where: {
            notificationId: {
                in: options.notificationIds,
            },
            userId: options.requester.userId,
        },
        data: {
            ...requesterFields.updateMany(options.requester),
            read: options.read,
        },
    });
}
