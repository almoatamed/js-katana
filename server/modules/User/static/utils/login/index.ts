const client = (await import("../../../instance/index.js")).UserInstanceClient;
import ObjectError from "$/server/utils/ObjectError/index.js";
const multirules = (await import("../../../../../utils/rules/multirules.js")).default;
const bcrypt = (await import("bcrypt")).default;

const generateUserJwtToken = (await import("../../../utils/index.js")).generateUserJwtToken;

type Options = {
    username: string;
    password: string;
};
export async function login(username: string | Options, password?: string) {
    let userData: any;
    if (arguments.length == 1) {
        userData = username as any;
    } else {
        userData = {
            username: username,
            password: password,
        };
    }

    // validation
    await multirules([
        [["required", "password"], userData.password, "password"],
        [["required", "username"], userData.username, "username"],
    ]);

    const user = await client.user.findFirst({
        where: {
            username: userData.username,
            active: true,
            deleted: false,
        },

        include: {
            userAuthorities: {
                where: {
                    deleted: false,
                },
                include: {
                    dynamicAuthorities: {
                        where: {
                            deleted: false,
                        },
                        include: {
                            dynamicAuthorityValues: {
                                where: {
                                    deleted: false,
                                },
                            },
                        },
                    },
                },
            },
            authorizationProfile: {
                include: {
                    profileAuthorities: {
                        where: {
                            deleted: false,
                        },
                        include: {
                            dynamicAuthorities: {
                                where: {
                                    deleted: false,
                                },
                                include: {
                                    dynamicAuthorityValues: {
                                        where: {
                                            deleted: false,
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
    });
    if (!user) {
        throw new ObjectError({
            error: { name: "authentication error", msg: "Invalid username" },
            statusCode: 403,
        });
    }
    const isValidPassword = bcrypt.compareSync(userData.password, user.password);
    if (!isValidPassword) {
        throw new ObjectError({
            error: { name: "authentication error", msg: "Invalid Password" },
            statusCode: 403,
        });
    }

    const token = generateUserJwtToken(user);
    const result = {
        token: token,
        user: {
            ...user,
        },
    };
    return result;
}
