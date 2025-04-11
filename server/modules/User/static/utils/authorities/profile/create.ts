import { Requester } from "../../../../../../utils/express/index.js";
import grant from "./grant.js";

const multirules = (await import("../../../../../../utils/rules/multirules.js")).default;
const client = (await import("$/server/utils/database/prisma.js")).default;

interface Options {
    newProfileName: string;
    asUserId?: number;
    asProfileId?: number;
    requesterUser: Requester;
    authorities: import("./grant.js").AuthoritiesRequest;
}

export default async function create(options: Options) {
    await multirules([
        [
            ["required", "title", "unique"],
            options.newProfileName,
            "New Profile Name",
            {
                unique: {
                    model: "authoritiesProfile",
                    uniqueKey: "name",
                },
            },
        ],
    ]);
    const profile = await client.$transaction(async (client) => {
        const newProfile = await client.authoritiesProfile.create({
            data: {
                name: options.newProfileName,

                createdAt: new Date(),
                createdByUser: !options?.requesterUser?.userId
                    ? undefined
                    : {
                          connect: {
                              userId: options?.requesterUser?.userId,
                          },
                      },
                createdByUserUsername: options.requesterUser?.username,
                createdByUserFullName: options.requesterUser?.fullName,
                updatedAt: new Date(),
                updatedByUser: !options?.requesterUser?.userId
                    ? undefined
                    : {
                          connect: {
                              userId: options?.requesterUser?.userId,
                          },
                      },
                updatedByUserUsername: options.requesterUser?.username,
                updatedByUserFullName: options.requesterUser?.fullName,
                deleted: false,
            },
        });

        await grant({
            authorities: options.authorities,
            overwrite: true,
            requesterUser: options.requesterUser,
            asProfileId: options.asProfileId,
            asUserId: options.asUserId,
            profileId: newProfile.profileId,
            tx: client,
        });

        return newProfile;
    });
    return profile;
}
