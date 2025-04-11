// @ts-nocheck
const firebase = (await import("$/server/utils/firebase/initialize/index.js")).default;
const client = (await import("$/server/utils/database/prisma.js")).default;

/**
 * @typedef {Object} NotificationContent
 * @property {String} title
 * @property {String} body
 */

/**
 * @typedef {Object} NotificationData
 * @property {String} args
 * @property {String} handler
 */

/**
 * @typedef {Object} SendNotificationOptions
 * @property {Array<Number>} usersIds
 * @property {NotificationContent} notification
 * @property {NotificationData} data
 *
 */

export default {
    /**
     * @param {SendNotificationOptions} params
     */
    async send(params) {
        params.data = { json: JSON.stringify(params.data) || "" };
        console.log(params);
        try {
            const usersTokens = (
                await client.devices.findMany({
                    where: {
                        deleted: false,
                        user: {
                            active: true,
                            deleted: false,
                            archived: false,
                            userId: !params.usersIds?.length
                                ? undefined
                                : {
                                      in: params.usersIds,
                                  },
                        },
                    },
                })
            ).map((dt) => dt.deviceToken);

            const notificationBody = {
                notification: params.notification,
                data: params.data,
                tokens: usersTokens,
            };
            console.log(notificationBody);
            if (usersTokens.length > 0) {
                const response = await firebase.messaging().sendMulticast(notificationBody);
                console.log(response);
            }
        } catch (error) {
            console.log("\n\nerror sending notifications, error:\n", error);
        }
    },
};
