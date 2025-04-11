const client = (await import("../../../instance/index.js")).UserInstanceClient;
import { $Enums, Prisma } from "$/prisma/client/index.js";
import ObjectError from "$/server/utils/ObjectError/index.js";
import { encryptionConfig } from "../../../../../config/encryption/index.js";
import requesterFields from "../../../../utils/requesterFields/index.js";
const multirules = (await import("../../../../../utils/rules/multirules.js")).default;
const bcrypt = (await import("bcrypt")).default;
type UserRegistrationBody = Prisma.UserCreateInput & {
    confirmPassword: string;
    password: string;
    fullName: string;
    userType: string;
    username: string;
    email?: string;
    phone?: string;
};

export const register = async (creator: any, attrs: UserRegistrationBody) => {
    await multirules([
        [
            ["required", "title"],
            attrs.userType,
            "User Type",
            {
                title: {
                    in: Object.keys($Enums.UserType),
                },
            },
        ],
        [
            ["required", "name", "unique"],
            attrs.fullName,
            "Full Name",
            {
                unique: {
                    model: "user",
                    uniqueKey: "fullName",
                },
            },
        ],
        [
            ["required", "username", "unique"],
            attrs.username,
            "Username",
            {
                unique: {
                    model: "user",
                    uniqueKey: "username",
                },
            },
        ],
        [["email"], attrs.email, "Email"],
        [["phone"], attrs.phone, "Phone"],
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

    const user = await client.user.create({
        data: {
            userType: attrs.userType,
            fullName: attrs.fullName,
            username: attrs.username,
            password: bcrypt.hashSync(attrs.password, await encryptionConfig.getSaltOrRounds()),
            active: true,
            archived: false,
            deleted: false,
            email: attrs.email,
            phone: attrs.phone,
            ...requesterFields.create(creator),
        },
    });

    return user;
};
