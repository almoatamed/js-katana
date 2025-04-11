import { User } from "$/prisma/client/index.js";

;
const client = (await import("$/server/utils/database/prisma.js")).default;

export const archive = async (archivedBy: User | undefined | null = undefined, user: User) => {
    if (user.active || user.archived || user.userId == 1 || user.username == "admin") {
        throw {
            statusCode: 400,
            error: {
                msg: "Cannot Archive this user account",
                body: user,
            },
        };
    }

    const updatedUser = await client.user.update({
        where: {
            userId: user.userId,
        },
        data: {
            updatedAt: new Date(),
            updatedByUser: !archivedBy
                ? undefined
                : {
                      connect: {
                          userId: archivedBy.userId,
                      },
                  },
            updatedByUserUsername: archivedBy?.username,
            updatedByUserFullName: archivedBy?.fullName,
            archived: true,
        },
    });

    return updatedUser;
};
