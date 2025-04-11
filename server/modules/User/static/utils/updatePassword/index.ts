const client = (await import("../../../instance/index.js")).UserInstanceClient;
import { User } from "$/prisma/client/index.js";
import ObjectError from "$/server/utils/ObjectError/index.js";
import { encryptionConfig } from "../../../../../config/encryption/index.js";
const multirules = (await import("../../../../../utils/rules/multirules.js")).default;
const bcrypt = (await import("bcrypt")).default;

const generateUserJwtToken = (await import("../../../utils/index.js")).generateUserJwtToken;

type UpdatePasswordProps = {
    userId: string | number;
    password: string;
    confirmPassword: string;
};
export const updatePassword = async (updatedBy: User | undefined | null = undefined, attrs: UpdatePasswordProps) => {
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
                },
            },
            {
                exists: {
                    obj: holder,
                    key: "user",
                },
            },
        ],
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

    return await client.user.update({
        where: {
            userId: Number(attrs.userId),
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
