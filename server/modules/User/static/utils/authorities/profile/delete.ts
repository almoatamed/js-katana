import ObjectError from "$/server/utils/ObjectError/index.js";

const multirules = (await import("../../../../../../utils/rules/multirules.js")).default;
const client = (await import("$/server/utils/database/prisma.js")).default;
const authorities = (await import("$/server/modules/User/static/utils/authorities/index.js")).default;

interface DeleteOptions {
    force?: Boolean;
    profileId: Number;
    authoritiesKeys: string[];
    requesterUser?: import("$/prisma/client/index.js").User;
}

export default async function deleteProfile(options: DeleteOptions) {
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
                            users: {
                                where: {
                                    deleted: false,
                                    active: true,
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
        users: Array<import("$/prisma/client/index.js").User>;
    } = holder.profile;

    if (profile.users?.length && !options.force) {
        throw new ObjectError({
            statusCode: 400,
            error: {
                msg: "This profile is used with those users",
                users: profile.users,
            },
        });
    }

    await client.$transaction(async (client) => {
        for (const user of profile.users) {
            await client.user.update({
                where: {
                    userId: user.userId,
                },
                data: {
                    authorizationProfile: {
                        disconnect: true,
                    },
                },
            });
        }
        await client.authoritiesProfile.update({
            where: {
                profileId: profile.profileId,
            },
            data: {
                deleted: true,
            },
        });
    });
}
