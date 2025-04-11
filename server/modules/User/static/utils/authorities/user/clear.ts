const multirules = (await import("../../../../../../utils/rules/multirules.js")).default;
const client = (await import("$/server/utils/database/prisma.js")).default;

interface Options {
    userId: Number;
    requesterUser?: import("$/prisma/client/index.js").User;
}

/**
 * @param {Options} options
 */
export default async function clear(options) {
    const holder: { user?: import("$/prisma/client/index.js").User } = {};

    await multirules([
        [
            ["required", "number", "exists"],
            options.userId,
            "User ID",
            {
                number: {
                    min: 1,
                },
                exists: {
                    model: "user",
                    idKey: "userId",
                    parseInt: true,
                    where: {
                        User: {
                            deleted: false,
                        },
                    },
                },
            },
            {
                exists: {
                    obj: holder,
                    key: "user",
                },
            },
        ],
    ]);

    await client.$transaction(async (client) => {
        await client.user.update({
            where: {
                userId: options.userId,
            },
            data: {
                defaultHomePageName: null,

                authorizationProfile: {
                    disconnect: true,
                },
            },
        });
        await client.userAuthority.updateMany({
            where: {
                userId: holder.user?.userId,
            },
            data: {
                deleted: true,
                updatedAt: new Date(),
                updatedByUserFullName: options.requesterUser?.fullName,
                updatedByUserUsername: options.requesterUser?.username,
                updatedByUserId: options.requesterUser?.userId,
            },
        });
    });
}
