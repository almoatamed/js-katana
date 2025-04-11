const client = (await import("$/server/utils/database/prisma.js")).default;
import { User } from "$/prisma/client/index.js";
import ObjectError from "$/server/utils/ObjectError/index.js";
import { encryptionConfig } from "../../../../../config/encryption/index.js";
const multirules = (await import("../../../../../utils/rules/multirules.js")).default;
const bcrypt = (await import("bcrypt")).default;

export type UpdatePasswordProps = {
    password: string;
    confirmPassword: string;
    requireOldPassword: boolean;
    oldPassword?: string;
};
export const updatePassword = async (
    attrs: UpdatePasswordProps,
    updatedBy: User | undefined | null = undefined,
    user: User,
) => {
    await multirules([
        [["required", "password"], attrs.password, "Password"],
        [["required", "password"], attrs.confirmPassword, "Confirm Password"],
    ]);

    if (attrs.password != attrs.confirmPassword) {
        throw new ObjectError({
            statusCode: 400,
            error: {
                msg: "Password Confirmation is not correct",
            },
        });
    }
    if (attrs.requireOldPassword) {
        await multirules([[["required", "password"], attrs.oldPassword, "Old Password"]]);
        if (!bcrypt.compareSync(attrs.oldPassword || "", user.password)) {
            throw new ObjectError({
                statusCode: 400,
                error: {
                    msg: "invalid old password",
                },
            });
        }
    }

    return await client.user.update({
        where: {
            userId: Number(user.userId),
        },
        data: {
            password: bcrypt.hashSync(attrs.password, await encryptionConfig.getSaltOrRounds()),
            updatedAt: new Date(),
            updatedByUser: {
                connect: !updatedBy
                    ? undefined
                    : {
                          userId: updatedBy.userId,
                      },
            },
            updatedByUserUsername: updatedBy?.username,
            updatedByUserFullName: updatedBy?.fullName,
        },
    });
};
