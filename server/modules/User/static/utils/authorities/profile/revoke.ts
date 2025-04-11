import ObjectError from "$/server/utils/ObjectError/index.js";

const multirules = (await import("../../../../../../utils/rules/multirules.js")).default;
const client = (await import("$/server/utils/database/prisma.js")).default;
const authorities = (await import("$/server/modules/User/static/utils/authorities/index.js")).default;

interface RevokeOptions {
    ignoreNotExisting?: Boolean;
    profileId: Number;
    requesterUser?: import("$/prisma/client/index.js").User;
    authoritiesKeys: Array<import("./grant.js").AuthoritiesNames>;
}

/**
 * @param {RevokeOptions} options
 */
export default async function revoke(options: RevokeOptions) {
    const holder = {} as any;
    await multirules([
        [
            ["required", "number", "exists"],
            options.profileId,
            "Profile ID",
            {
                number: {
                    min: 1,
                },
                exists: {
                    idKey: "profileId",
                    parseInt: true,
                    model: "authoritiesProfile",
                    include: {
                        AuthoritiesProfile: {
                            profileAuthorities: {
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
                    key: "profile",
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

    const profile: import("$/prisma/client/index.js").AuthoritiesProfile & {
        profileAuthorities: Array<import("$/prisma/client/index.js").ProfileAuthority>;
    } = holder.profile;

    if (!options.ignoreNotExisting) {
        const foundAuthorities = profile.profileAuthorities.filter((ua) =>
            options.authoritiesKeys.includes(ua.keyName as any),
        );
        if (foundAuthorities.length != options.authoritiesKeys.length) {
            throw new ObjectError({
                statusCode: 404,
                error: {
                    msg: "not all key names of authorities to be revoked were found (use ignoreNotExisting flag if you want to ignore this error)",
                    foundAuthorities,
                    notFoundAuthorities: options.authoritiesKeys.filter(
                        (ak) => !foundAuthorities.find((fa) => fa.keyName == ak),
                    ),
                },
            });
        }
    }

    await client.profileAuthority.updateMany({
        where: {
            keyName: {
                in: options.authoritiesKeys,
            },
            profileId: profile.profileId,
        },
        data: {
            updatedAt: new Date(),
            updatedByUserId: options?.requesterUser?.userId,
            updatedByUserUsername: options.requesterUser?.username,
            updatedByUserFullName: options.requesterUser?.fullName,
            deleted: true,
        },
    });
}
