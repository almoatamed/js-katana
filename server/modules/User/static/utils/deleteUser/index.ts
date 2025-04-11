const client = (await import("../../../instance/index.js")).UserInstanceClient;
const multirules = (await import("../../../../../utils/rules/multirules.js")).default;

type DeleteProps = {
    userId: number;
};
export const deleteUser = async (deletionBy: any, attrs: DeleteProps) => {
    const holder: any = {};
    await multirules([
        [
            ["required", "number", "exists"],
            attrs.userId,
            "User ID",
            {
                number: {
                    min: 0,
                },
                exists: {
                    model: "user",
                    idKey: "userId",
                    parseInt: true,
                    include: {
                        User: {
                            createdUserLog: {
                                take: 1,
                                where: {
                                    deleted: false,
                                },
                            },
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

    if (
        holder.user.active ||
        holder.user.createdUsersLogs?.length ||
        holder.user.userId == 1 ||
        holder.user.username == "admin"
    ) {
        throw {
            statusCode: 400,
            error: {
                msg: "Cannot Delete this user account",
                body: attrs,
            },
        };
    }

    return await client.user.update({
        where: {
            userId: Number(attrs.userId),
        },
        data: {
            updatedAt: new Date(),
            updatedByUser: !deletionBy
                ? undefined
                : {
                      connect: {
                          userId: deletionBy?.userId,
                      },
                  },
            updatedByUserUsername: deletionBy?.username,
            updatedByUserFullName: deletionBy?.fullName,
            deleted: true,
        },
    });
};
