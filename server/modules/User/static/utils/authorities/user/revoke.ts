;
import ObjectError from "$/server/utils/ObjectError/index.js";
import { Requester } from "../../../../../../utils/express/index.js";
import requesterFields from "../../../../../utils/requesterFields/index.js";

const multirules = (await import("../../../../../../utils/rules/multirules.js")).default;
const client = (await import("$/server/utils/database/prisma.js")).default;
const authorities = (await import("$/server/modules/User/static/utils/authorities/index.js")).default;

interface RevokeOptions {
    ignoreNotExisting?: Boolean;
    userId: Number;
    requesterUser?: Requester;
    authoritiesKeys: Array<import("./grant.js").AuthoritiesNames>;
    [key: string]: any;
}

export default async function revoke(options: RevokeOptions) {
    await multirules([
        [
            ["required", "number", "exists"],
            options.userId,
            "User ID",
            {
                number: {
                    min: 1,
                },
                exists: {
                    idKey: "userId",
                    parseInt: true,
                    model: "user",
                    include: {
                        User: {
                            userAuthorities: {
                                where: {
                                    deleted: false,
                                },
                            },
                            authorizationProfile: true,
                        },
                    },
                },
            },
            {
                exists: {
                    obj: options,
                    key: "user",
                },
            },
        ],
        [
            ["required", "array"],
            options.authoritiesKeys,
            "Authorities Keys",
            {
                array: ["string"],
            },
        ],
    ]);
    /**
     * @type {import("$/prisma/client/index.js").users & {
     *     userAuthorities: Array<import("$/prisma/client/index.js").usersAuthorities>
     * }}
     */
    const user = options.user;
    if (user.authorizationProfileId && !user.authorizationProfile?.deleted) {
        throw new ObjectError({
            statusCode: 400,
            error: {
                msg: "this user uses authorization profile, if you want to clear all the user granted access use 'clear'",
                profileId: user.authorizationProfileId,
            },
        });
    }

    if (!options.ignoreNotExisting) {
        const foundAuthorities = user.userAuthorities.filter((ua) => options.authoritiesKeys.includes(ua.keyName));
        if (foundAuthorities.length != options.authoritiesKeys.length) {
            throw new ObjectError({
                statusCode: 404,
                error: {
                    msg: "not all key names of authorities to be revoked were found (use ignoreNotExisting flag if you want to ignore this error)",
                    foundAuthorities,
                    notFoundAuthorities: options.authoritiesKeys.filter((ak) => !foundAuthorities.find((fa) => fa.keyName == ak)),
                },
            });
        }
    }

    await client.userAuthority.updateMany({
        where: {
            keyName: {
                in: options.authoritiesKeys,
            },
            userId: user.userId,
        },
        data: {
            ...requesterFields.updateMany(options.requesterUser),
            deleted: true,
        },
    });
}
