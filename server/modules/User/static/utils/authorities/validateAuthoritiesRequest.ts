import ObjectError from "$/server/utils/ObjectError/index.js";
import { Requester } from "../../../../../utils/express/index.js";

const multirules = (await import("../../../../../utils/rules/multirules.js")).default;
const client = (await import("$/server/modules/index.js")).default;
const authorities = (await import("./index.js")).default.authorities;

export interface ProcessedDynamicAuthorityRequest {
    body:
        | import("$/prisma/client/index.js").Prisma.UserDynamicAuthorityCreateInput
        | import("$/prisma/client/index.js").Prisma.ProfileDynamicAuthorityCreateInput;
    values?: Array<string>;
}

export interface ProcessedAuthorityRequest {
    body:
        | import("$/prisma/client/index.js").Prisma.UserAuthorityCreateInput
        | import("$/prisma/client/index.js").Prisma.ProfileAuthorityCreateInput;
    dynamicAuthorities?: Array<ProcessedDynamicAuthorityRequest>;
}

export interface ValidateOptions {
    authorities: import("./user/grant.js").AuthoritiesRequest;
    asUserId?: number;
    asProfileId?: number;
    requesterUser?: Requester;
}

async function addAuthoritiesFromAUserProfile(userId: number, list: import("./user/grant.js").AuthoritiesRequest) {
    const holder: any = {};
    await multirules([
        [
            ["required", "number", "exists"],
            userId,
            "As In User ID",
            {
                number: {
                    min: 1,
                },
                exists: {
                    model: "user",
                    idKey: "userId",
                    parseInt: true,
                    include: {
                        User: {
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
                        },
                    },
                },
            },
            {
                exists: {
                    obj: holder,
                    key: "user",
                },
            },
        ],
    ]);

    const user: import("$/prisma/client/index.js").Prisma.UserGetPayload<{
        include: {
            userAuthorities: {
                where: {
                    deleted: false;
                };
                include: {
                    dynamicAuthorities: {
                        where: {
                            deleted: false;
                        };
                        include: {
                            dynamicAuthorityValues: {
                                where: {
                                    deleted: false;
                                };
                            };
                        };
                    };
                };
            };
        };
    }> = holder.user;
    for (const authority of user.userAuthorities) {
        if (list.find((ar) => ar.keyName == authority.keyName)) {
            continue;
        }

        const authorityRequest: import("./user/grant.js").AuthorityRequest = {
            keyName: authority.keyName as any,
            all: authority.all,
        };
        if (authority.all) {
            list.push(authorityRequest);
            continue;
        }
        for (const dynamicAuthority of authority.dynamicAuthorities) {
            authorityRequest.dynamicAuthoritiesArray?.push({
                dynamicAuthorityKey: dynamicAuthority.dynamicAuthorityKey,
                all: dynamicAuthority.all,
                values: dynamicAuthority.dynamicAuthorityValues?.map((v) => v.value),
            });
        }
    }
}

async function addAuthoritiesFromAnAuthorizationProfile(
    profileId: number,
    list: import("./user/grant.js").AuthoritiesRequest,
) {
    const holder: any = {};
    await multirules([
        [
            ["required", "number", "exists"],
            profileId,
            "As In Profile ID",
            {
                number: {
                    min: 1,
                },
                exists: {
                    model: "authoritiesProfile",
                    idKey: "profileId",
                    parseInt: true,
                    include: {
                        AuthoritiesProfile: {
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
            },
            {
                exists: {
                    obj: holder,
                    key: "profile",
                },
            },
        ],
    ]);

    const profile: import("$/prisma/client/index.js").Prisma.AuthoritiesProfileGetPayload<{
        include: {
            profileAuthorities: {
                where: {
                    deleted: false;
                };
                include: {
                    dynamicAuthorities: {
                        where: {
                            deleted: false;
                        };
                        include: {
                            dynamicAuthorityValues: {
                                where: {
                                    deleted: false;
                                };
                            };
                        };
                    };
                };
            };
        };
    }> = holder.profile;
    for (const authority of profile.profileAuthorities) {
        if (list.find((ar) => ar.keyName == authority.keyName)) {
            continue;
        }

        /**
         * @type {import("./user/grant.js").AuthorityRequest}
         */
        const authorityRequest: import("./user/grant.js").AuthorityRequest = {
            keyName: authority.keyName as any,
            all: authority.all,
        };
        if (authority.all) {
            list.push(authorityRequest);
            continue;
        }
        for (const dynamicAuthority of authority.dynamicAuthorities) {
            authorityRequest.dynamicAuthoritiesArray?.push({
                dynamicAuthorityKey: dynamicAuthority.dynamicAuthorityKey,
                all: dynamicAuthority.all,
                values: dynamicAuthority.dynamicAuthorityValues?.map((v) => v.value),
            });
        }
    }
}

export default async function validate(options: ValidateOptions): Promise<Array<ProcessedAuthorityRequest>> {
    if (options.asProfileId && options.asUserId) {
        throw new ObjectError({
            statusCode: 400,
            error: {
                msg: 'you can either provide "as in user id" or "as in profile id" but not both',
            },
        });
    }

    if (options.asProfileId) {
        await addAuthoritiesFromAnAuthorizationProfile(options.asProfileId, options.authorities);
    } else if (options.asUserId) {
        await addAuthoritiesFromAUserProfile(options.asUserId, options.authorities);
    }

    const processedAuthorities: Array<ProcessedAuthorityRequest> = [];
    for (const authority of options.authorities) {
        if (!authority.keyName) {
            throw new ObjectError({
                statusCode: 400,
                error: {
                    msg: "key name is not provides for this authority",
                    authority: authority,
                },
            });
        }

        const authoritySchema = authorities[authority.keyName];
        if (!authoritySchema) {
            throw new ObjectError({
                statusCode: 404,
                error: {
                    msg: "authority not found",
                    authority: authority,
                },
            });
        }

        const authorityBody:
            | import("$/prisma/client/index.js").Prisma.UserAuthorityCreateInput
            | import("$/prisma/client/index.js").Prisma.ProfileAuthorityCreateInput = {
            keyName: authority.keyName,
            all: false,
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
            dynamicAuthorities: undefined,
        };

        if (authority.all || !Object.values(authoritySchema.dynamicAuthorities || {}).length) {
            authorityBody.all = true;
            processedAuthorities.push({
                body: authorityBody,
                dynamicAuthorities: undefined,
            });
            continue;
        }
        /**
         * @type {Array<ProcessedDynamicAuthorityRequest>}
         */
        const processedDynamicAuthorities: any[] = [];
        for (const dynamicAuthoritySchema of Object.values(authoritySchema.dynamicAuthorities || []) as any) {
            const requestedDynamicAuthority = authority.dynamicAuthoritiesArray?.find((da) => {
                return da.dynamicAuthorityKey == dynamicAuthoritySchema?.dynamicAuthorityKey;
            });
            if (!requestedDynamicAuthority) {
                throw new ObjectError({
                    statusCode: 404,
                    error: {
                        msg: "dynamic authority not found",
                        dynamicAuthoritySchema,
                        authority,
                    },
                });
            }

            /**
             * @type {import("$/prisma/client/index.js").Prisma.UserDynamicAuthorityCreateInput|import("$/prisma/client/index.js").Prisma.profilesDynamicAuthoritiesCreateInput}
             */
            const dynamicAuthorityBody = {
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
                dynamicAuthorityKey: dynamicAuthoritySchema.dynamicAuthorityKey,
                all: false,
            };

            if (requestedDynamicAuthority.all) {
                processedDynamicAuthorities.push({
                    body: dynamicAuthorityBody,
                    values: null,
                });
            }

            await multirules([
                [
                    ["array"],
                    requestedDynamicAuthority.values,
                    "Dynamic Authority Values",
                    {
                        array: ["number", "string"],
                    },
                ],
            ]);

            if (dynamicAuthoritySchema.model) {
                const foundValues = await (client[dynamicAuthoritySchema.model] as any).findMany({
                    where: {
                        deleted: false,
                        [dynamicAuthoritySchema.idKey]: {
                            in: requestedDynamicAuthority.values?.map((v) => {
                                return dynamicAuthoritySchema.idType == "number" ? Math.floor(v as any) : v;
                            }),
                        },
                    },
                });
                if (foundValues.length != requestedDynamicAuthority.values?.length) {
                    throw new ObjectError({
                        statusCode: 404,
                        error: {
                            msg: "some values are not found",
                            foundValues,
                            notFoundValues: requestedDynamicAuthority.values?.filter((v) => !foundValues.includes(v)),
                            requestedDynamicAuthority,
                            authority,
                        },
                    });
                }
            } else {
                /**
                 * @type {Array<*>}
                 */
                const resource = await dynamicAuthoritySchema.loadResourceCb();

                const foundValues = resource.filter((v) => requestedDynamicAuthority.values?.includes(v));

                if (foundValues.length != requestedDynamicAuthority.values?.length) {
                    throw new ObjectError({
                        statusCode: 404,
                        error: {
                            msg: "some values are not found",
                            foundValues,
                            notFoundValues: requestedDynamicAuthority.values?.filter((v) => !foundValues.includes(v)),
                            requestedDynamicAuthority,
                            authority,
                        },
                    });
                }
            }

            processedDynamicAuthorities.push({
                body: dynamicAuthorityBody,
                values: requestedDynamicAuthority.values?.map((v) => String(v)),
            });
        }

        processedAuthorities.push({
            body: authorityBody,
            dynamicAuthorities: processedDynamicAuthorities,
        });
    }

    return processedAuthorities;
}
