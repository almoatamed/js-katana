const client = (await import("$/server/utils/database/prisma.js")).default;
const multirules = (await import("../../../../../utils/rules/multirules.js")).default;

export type UpdateSelfParams = {
    fullName?: string;
    username?: string;
    phone?: string;
    email?: string;
};

export const updateSelf = async (currentUser: any, payload: UpdateSelfParams) => {
    await multirules([
        [
            ["name", "unique"],
            payload.fullName,
            "Full Name",
            {
                unique: {
                    model: "user",
                    uniqueKey: "fullName",
                    exceptId: Number(currentUser?.userId),
                    idKey: "userId",
                },
            },
        ],
        [
            ["username", "unique"],
            payload.username,
            "Username",
            {
                unique: {
                    model: "user",
                    uniqueKey: "username",
                    exceptId: Number(currentUser?.userId),
                    idKey: "userId",
                },
            },
        ],
        [["email"], payload.email, "Email"],
        [["phone"], payload.phone, "Phone"],
    ]);

    if (currentUser?.userId == 1) {
        if (!!payload.username && payload.username != "admin") {
            throw {
                statusCode: 400,
                error: {
                    msg: "Cannot change super admin username",
                    body: payload,
                },
            };
        }
    }

    return await client.user.update({
        where: {
            userId: Number(currentUser?.userId),
        },
        data: {
            fullName: payload.fullName || undefined,
            username: payload.username || undefined,
            email: payload.email,
            phone: payload.phone,
            updatedAt: new Date(),
            updatedByUser: {
                connect: {
                    userId: currentUser.userId,
                },
            },
            updatedByUserUsername: currentUser.username,
            updatedByUserFullName: currentUser.fullName,
        },
    });
};
