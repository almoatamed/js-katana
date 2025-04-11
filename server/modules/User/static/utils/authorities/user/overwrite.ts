import client from "$/server/utils/database/prisma.js";
import ObjectError from "$/server/utils/ObjectError/index.js";
import { Requester } from "../../../../../../utils/express/index.js";
import multirule from "../../../../../../utils/rules/multirules.js";
import requesterFields from "../../../../../utils/requesterFields/index.js";
import grant from "./grant.js";
interface UseProfileOptions {
    profileId?: number;
    profileName?: String;
    userId?: number;
    requesterUser?: Requester;
    [key: string]: any;
}

async function useProfile(options: UseProfileOptions) {
    if (options.profileId) {
        await multirule([
            [
                ["required", "number", "exists"],
                options.profileId,
                "Authorities Profile ID",
                {
                    number: {
                        min: 1,
                    },
                    exists: {
                        model: "authoritiesProfile",
                        idKey: "profileId",
                        parseInt: true,
                    },
                },
                {
                    exists: {
                        obj: options,
                        key: "profile",
                    },
                },
            ],
        ]);
    } else if (options.profileName) {
        await multirule([
            [
                ["required", "title", "exists"],
                options.profileName,
                "Authorities Profile Name",
                {
                    exists: {
                        model: "authoritiesProfile",
                        idKey: "name",
                        parseInt: false,
                    },
                },
                {
                    exists: {
                        obj: options,
                        key: "profile",
                    },
                },
            ],
        ]);
    } else {
        throw new ObjectError({
            msg: "on using a profile, you must either specify the name or the id of the profile",
        });
    }
    await multirule([
        [
            ["required", "number", "exists"],
            options.userId,
            "User ID",
            {
                number: {
                    min: 1,
                },
                exists: {
                    model: "user",
                    idKey: "userId",
                    parseInt: true,
                    where: {
                        User: {
                            deleted: false,
                            active: true,
                            archived: false,
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
    ]);

    if (options.user.username == "admin") {
        throw {
            statusCode: 400,
            error: {
                msg: "Cannot Change Super Admin Authorities",
            },
        };
    }

    await client.$transaction(async (client) => {
        await client.userAuthority.updateMany({
            where: {
                deleted: false,
                userId: options.user.userId,
            },
            data: {
                updatedAt: new Date(),
                updatedByUserId: options?.requesterUser?.userId,
                updatedByUserUsername: options.requesterUser?.username,
                updatedByUserFullName: options.requesterUser?.fullName,
                deleted: true,
            },
        });
        await client.user.update({
            where: {
                userId: options.user.userId,
            },
            data: {
                ...requesterFields.update(options.requesterUser),
                authorizationProfile: {
                    connect: {
                        profileId: options.profile.profileId,
                    },
                },
            },
        });
    });
}

export { useProfile };

export default async function overwrite(
    options: import("./grant.js").Options & {
        useProfile?: boolean | undefined | null;
        profileId?: number | undefined | null;
        profileName?: string | undefined | null;
    },
) {
    if (options.useProfile) {
        await useProfile({
            profileId: options.profileId as any,
            userId: options.userId,
            profileName: options.profileName as any,
            requesterUser: options.requesterUser,
        });
    } else {
        options.overwrite = true;
        await grant(options);
    }
}
