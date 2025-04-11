const client = (await import("../../../instance/index.js")).UserInstanceClient;
import ObjectError from "$/server/utils/ObjectError/index.js";
const multirules = (await import("../../../../../utils/rules/multirules.js")).default;

;

type DeactivateProps = {
    userId: number;
};

export const deactivate = async (activator: any, props: DeactivateProps) => {
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
    if (!user.active) {
        throw new ObjectError({
            statusCode: 400,
            error: {
                msg: "This user account is inactive already",
                body: props,
            },
        });
    }

    const nextUser = await client.user.update({
        where: {
            userId: Number(props.userId),
        },
        data: {
            updatedAt: new Date(),
            updatedByUser: {
                connect: {
                    userId: activator.userId,
                },
            },
            updatedByUserUsername: activator.username,
            updatedByUserFullName: activator.fullName,
            active: false,
        },
    });

    return nextUser;
};
