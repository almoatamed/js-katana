import { User } from "$/prisma/client/index.js";
import ObjectError from "$/server/utils/ObjectError/index.js";

const client = (await import("$/server/utils/database/prisma.js")).default;
export async function activateUser(user: User, requester: any = undefined) {
    if (user.active) {
        throw new ObjectError({
            statusCode: 400,
            error: {
                msg: "This user account is active already",
            },
        });
    }
    const activeUser = await client.user.update({
        where: {
            userId: user.userId,
        },
        data: {
            updatedAt: new Date(),
            updatedByUser: !requester
                ? undefined
                : {
                      connect: {
                          userId: requester.userId,
                      },
                  },
            updatedByUserUsername: !requester ? undefined : requester.username,
            updatedByUserFullName: !requester ? undefined : requester.fullName,
            active: true,
        },
    });
    return activeUser;
}
