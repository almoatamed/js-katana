import { Requester } from "../../../../../../utils/express/index.js";
import { AuthoritiesRequest } from "../user/grant.js";
import validate from "../validateAuthoritiesRequest.js";
export { AuthoritiesRequest };
const multirules = (await import("../../../../../../utils/rules/multirules.js")).default;
const originalClient = (await import("$/server/utils/database/prisma.js")).default;

export type AuthoritiesNames = import("$/server/middlewares/authorize.middleware.js").AuthoritiesNames;

export interface DynamicAuthority {
    all?: boolean;
    dynamicAuthorityKey: string;
    values?: Array<number | string> | null;
}

export interface AuthorityRequest {
    keyName: AuthoritiesNames;
    all?: boolean;
    dynamicAuthoritiesArray?: Array<DynamicAuthority>;
}

export interface Options {
    profileId: number;
    overwrite: boolean;
    asUserId?: number;
    asProfileId?: number;
    requesterUser: Requester;
    authorities: AuthoritiesRequest;
    tx?: import("$/server/utils/database/prisma.js").Client;
}

export default async function grant(options: Options) {
    const client = options.tx || originalClient;
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
                    model: "authoritiesProfile",
                    idKey: "profileId",
                    parseInt: true,
                    where: {
                        AuthoritiesProfile: {
                            deleted: false,
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
            options.authorities,
            "Authorities",
            {
                array: ["object"],
            },
        ],
    ]);

    const profile: import("$/prisma/client/index.js").AuthoritiesProfile = holder.profile;

    // validation
    const processedAuthorities = await validate({
        authorities: options.authorities,
        requesterUser: options.requesterUser,
        asProfileId: options.asProfileId,
        asUserId: options.asUserId,
    });

    // insertion
    const insertion = async (client) => {
        await client.profileAuthority.updateMany({
            where: {
                profileId: profile.profileId,
                keyName: !options.overwrite
                    ? undefined
                    : {
                          in: processedAuthorities.map((pa) => pa.body.keyName),
                      },
            },
            data: {
                updatedAt: new Date(),
                updatedByUserId: options?.requesterUser?.userId,
                updatedByUserUsername: options.requesterUser?.username,
                updatedByUserFullName: options.requesterUser?.fullName,
                deleted: true,
            },
        });
        for (const authority of processedAuthorities) {
            const profileAuthority = await client.profileAuthority.create({
                data: {
                    ...authority.body,
                    profile: {
                        connect: {
                            profileId: profile.profileId,
                        },
                    },
                },
            });
            if (authority.dynamicAuthorities?.length) {
                for (const dynamicAuthority of authority.dynamicAuthorities) {
                    await client.profileAuthority.update({
                        where: {
                            authorityId: profileAuthority.authorityId,
                        },
                        data: {
                            dynamicAuthorities: {
                                create: {
                                    ...dynamicAuthority.body,
                                    dynamicAuthorityValues: dynamicAuthority.body.all
                                        ? undefined
                                        : {
                                              createMany: {
                                                  data: dynamicAuthority.values?.map((value) => {
                                                      return {
                                                          createdAt: new Date(),
                                                          createdByUserId: options?.requesterUser?.userId,
                                                          createdByUserUsername: options.requesterUser?.username,
                                                          createdByUserFullName: options.requesterUser?.fullName,
                                                          updatedAt: new Date(),
                                                          updatedByUserId: options?.requesterUser?.userId,
                                                          updatedByUserUsername: options.requesterUser?.username,
                                                          updatedByUserFullName: options.requesterUser?.fullName,
                                                          deleted: false,
                                                          value: value,
                                                      };
                                                  }),
                                              },
                                          },
                                },
                            },
                        },
                    });
                }
            }
        }
    };
    if (options.tx) {
        await insertion(client);
    } else {
        await client.$transaction(async (client) => {
            await insertion(client);
        });
    }
}
