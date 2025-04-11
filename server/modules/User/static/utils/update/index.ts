const client = (await import("../../../instance/index.js")).UserInstanceClient;
const multirules = (await import("../../../../../utils/rules/multirules.js")).default;

export type UpdateParams = {
    userId: number;
    fullName?: string;
    username?: string;
    phone?: string;
    email?: string;
};

export const update = async (requester: any = undefined, payload: UpdateParams) => {
    const holder: any = {};
    await multirules([
        [
            ["required", "number", "exists"],
            payload.userId,
            "User ID",
            {
                number: {
                    min: 0,
                },
                exists: {
                    model: "user",
                    idKey: "userId",
                    parseInt: true,
                },
            },
            {
                exists: {
                    obj: holder,
                    key: "user",
                },
            },
        ],
        [
            ["name", "unique"],
            payload.fullName,
            "Full Name",
            {
                unique: {
                    model: "user",
                    uniqueKey: "fullName",
                    exceptId: Number(payload.userId),
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
                    exceptId: Number(payload.userId),
                    idKey: "userId",
                },
            },
        ],
        [["email"], payload.email, "Email"],
        [["phone"], payload.phone, "Phone"],
    ]);

    if (payload.userId == 1) {
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
            userId: Number(payload.userId),
        },
        data: {
            fullName: payload.fullName || undefined,
            username: payload.username || undefined,
            email: payload.email,
            phone: payload.phone,
            updatedAt: new Date(),
            updatedByUser: !requester
                ? undefined
                : {
                      connect: {
                          userId: requester.userId,
                      },
                  },
            updatedByUserUsername: requester?.username,
            updatedByUserFullName: requester?.fullName,
        },
    });
};
