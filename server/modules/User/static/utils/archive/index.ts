const client = (await import("../../../instance/index.js")).UserInstanceClient;
import { User } from "$/prisma/client/index.js";
import ObjectError from "$/server/utils/ObjectError/index.js";
const multirules = (await import("../../../../../utils/rules/multirules.js")).default;

;

type ArchiveProps = {
    userId: number;
};

export const archive = async (archivedBy: User | undefined | null = undefined, props: ArchiveProps) => {
    const holder: any = {};
    await multirules([
        [
            ["required", "number", "exists"],
            props.userId,
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
    ]);

    const user = holder.user;
    if (user.active || user.archived || user.userId == 1 || user.username == "admin") {
        throw new ObjectError({
            statusCode: 400,
            error: {
                msg: "Cannot Archive this user account",
                body: props,
            },
        });
    }

    const updatedUser = await client.user.update({
        where: {
            userId: Math.floor(props.userId as any),
        },
        data: {
            updatedAt: new Date(),
            updatedByUser: {
                connect: !archivedBy
                    ? undefined
                    : {
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
