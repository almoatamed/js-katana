import { Prisma } from "../../../../../../../../prisma/client/index.js";

const client = (await import("$/server/utils/database/prisma.js")).default;

const auth = (await import("$/server/middlewares/user.middleware.js")).default.auth;
const authorize = (await import("$/server/middlewares/authorize.middleware.js")).default.authorize;

const multirule = (await import("../../../../../../../utils/rules/multirules.js")).default;

const express = (await import("$/server/utils/express/index.js")).default;

// authorities
const authorities = (await import("$/server/modules/User/static/utils/authorities/index.js")).default;

const router = express.Router();

router.post(
    "/",
    auth,
    authorize({
        url: import.meta.url,
        allow: {
            or: ["changeUserAuthorities"],
        },
    }),
    async (request, response, next) => {
        try {
            // validation
            
            await multirule([
                [
                    ["required", "title", "unique"],
                    request.body.name,
                    "Name",
                    {
                        unique: {
                            model: "authoritiesProfile",
                            uniqueKey: "name",
                        },
                    },
                ],
                [["title"], request.body.to, "Default Home Page"],
                [
                    ["required", "array"],
                    request.body.authorities,
                    "Authorities List",
                    {
                        array: ["object"],
                    },
                ],
            ]);

            const authoritiesList = [] as any[];
            for (const authority of request.body.authorities || []) {
                // validate the authority
                /**
                 * 1- check if the authoirty key exists, if not throw--
                 * 2- if authority.all continue--
                 * 3- check if the authority has any dynamic authorities, if not set the authority.all to true and contineu --
                 * 4- for each dynamic authority in the source authority.dynamicAuthoirities
                 *    1- make sure that the dynamic authority key is in the authoirty.dynamicAuthoiritiesArray, if not throw --
                 *    2- if dynamic authority.all continue --
                 *    3- make sure the values array is given and it has list of values that either string, or number --
                 *    4- for each element in the values array --
                 *       1- make sure that the value exists in the source model, if not throw, --
                 *
                 *
                 */

                /**
                 *
                 * @type {Prisma.UserAuthorityCreateInput}
                 */
                const authorityBody = {
                    keyName: authority.keyName,
                    all: false,

                    createdAt: new Date(),
                    createdByUser: {
                        connect: {
                            userId: request.user.userId,
                        },
                    },
                    createdByUserUsername: request.user.username,
                    createdByUserFullName: request.user.fullName,
                    updatedAt: new Date(),
                    updatedByUser: {
                        connect: {
                            userId: request.user.userId,
                        },
                    },
                    updatedByUserUsername: request.user.username,
                    updatedByUserFullName: request.user.fullName,
                    deleted: false,
                    dynamicAuthorities: undefined,
                };

                if (!authority.keyName || !authorities.authorities[authority.keyName]) {
                    throw {
                        statusCode: 400,
                        error: {
                            msg: "The Provided authority Does not exists",
                            authority: authority,
                            authorities: authorities.authorities,
                            body: request.body,
                        },
                    };
                }

                if (!Object.values(authorities.authorities[authority.keyName].dynamicAuthorities || {}).length) {
                    authority.all = true;
                }

                if (authority.all) {
                    authorityBody.all = true;
                    authoritiesList.push({ authorityBody: authorityBody, dynamicAuthoiritiesList: null });
                    continue;
                }

                const dynamicAuthoiritiesList = [] as any[];
                for (const dynamicAuthority of Object.values(authorities.authorities[authority.keyName].dynamicAuthorities || [])) {
   
                    const dynamicAuthorityBody: any = {
                        createdAt: new Date(),
                        createdByUser: {
                            connect: {
                                userId: request.user.userId,
                            },
                        },
                        createdByUserUsername: request.user.username,
                        createdByUserFullName: request.user.fullName,
                        updatedAt: new Date(),
                        updatedByUser: {
                            connect: {
                                userId: request.user.userId,
                            },
                        },
                        updatedByUserUsername: request.user.username,
                        updatedByUserFullName: request.user.fullName,
                        deleted: false,

                        all: false,
                    };

                    const profileDynamicAuthority = authority.dynamicAuthoritiesArray.find(
                        (profileDynamicAuthority) => profileDynamicAuthority.dynamicAuthorityKey == dynamicAuthority.dynamicAuthorityKey,
                    );
                    if (!profileDynamicAuthority) {
                        throw {
                            statusCode: 400,
                            error: {
                                msg: "cannot find dynamic authority",
                                authority: authority,
                                dynamicAuthority: dynamicAuthority,
                            },
                        };
                    }

                    (dynamicAuthorityBody as any).dynamicAuthorityKey = dynamicAuthority.dynamicAuthorityKey;

                    if (profileDynamicAuthority.all) {
                        dynamicAuthorityBody.all = true;
                        dynamicAuthoiritiesList.push({ dynamicAuthorityBody: dynamicAuthorityBody, values: null });
                        continue;
                    }

                    await multirule([
                        [
                            ["required", "array"],
                            profileDynamicAuthority.values,
                            "Value of Dynamic Authority",
                            {
                                array: ["string", "number"],
                            },
                        ],
                    ]);

                    for (const value of profileDynamicAuthority.values) {
                        // find the value in target model
                        let item = null as null | number | string;
                        if (dynamicAuthority.model) {
                            item = await (client as any)[dynamicAuthority.model].findFirst({
                                where: {
                                    deleted: false,
                                    [dynamicAuthority.idKey]: dynamicAuthority.idType == "number" ? Math.floor(Number(value)) : value,
                                },
                            });
                        } else if (dynamicAuthority.loadResourceCb) {
                            const source = dynamicAuthority.loadResourceCb(request);
                            item = source.find((item) => ((item[dynamicAuthority.idKey] == (dynamicAuthority.idType == "number" ? Math.floor(Number(value)) : value)))) || null;
                        }

                        if (!item) {
                            throw {
                                statusCode: 400,
                                error: {
                                    msg: "Value not found",
                                    value: value,
                                    profileDynamicAuthority: profileDynamicAuthority,
                                    body: request.body,
                                },
                            };
                        }
                    }

                    dynamicAuthoiritiesList.push({ dynamicAuthorityBody: dynamicAuthorityBody, values: profileDynamicAuthority.values });
                }
                authoritiesList.push({ authorityBody: authorityBody, dynamicAuthoiritiesList: dynamicAuthoiritiesList });
            }

            // insert them
            /**
             * 1- delete the old authorities
             * 2- for each authority
             *    1- insert the authority
             *    2- for each dynamic authority
             *       1- insert it into the authorities dynamic authorities with the values mapped
             */
            const profile = await client.authoritiesProfile.create({
                data: {
                    name: request.body.name,

                    defaultHomePageName: request.body.to,
                    createdAt: new Date(),
                    createdByUser: {
                        connect: {
                            userId: request.user.userId,
                        },
                    },
                    createdByUserUsername: request.user.username,
                    createdByUserFullName: request.user.fullName,
                    updatedAt: new Date(),
                    updatedByUser: {
                        connect: {
                            userId: request.user.userId,
                        },
                    },
                    updatedByUserUsername: request.user.username,
                    updatedByUserFullName: request.user.fullName,
                    deleted: false,
                },
            });

            for (const authority of authoritiesList) {
                const profileAuthority = await client.profileAuthority.create({
                    data: {
                        ...authority.authorityBody,
                        profile: {
                            connect: {
                                profileId: profile.profileId,
                            },
                        },
                    },
                });
                if (authority.dynamicAuthoiritiesList?.length) {
                    for (const dynamicAuthority of authority.dynamicAuthoiritiesList) {
                        await client.profileAuthority.update({
                            where: {
                                authorityId: profileAuthority.authorityId,
                            },
                            data: {
                                dynamicAuthorities: {
                                    create: {
                                        ...dynamicAuthority.dynamicAuthorityBody,
                                        dynamicAuthorityValues: dynamicAuthority.dynamicAuthorityBody.all
                                            ? undefined
                                            : {
                                                  createMany: {
                                                      data: dynamicAuthority.values?.map((value) => {
                                                          return {
                                                              createdAt: new Date(),
                                                              createdByUserId: request.user.userId,
                                                              createdByUserUsername: request.user.username,
                                                              createdByUserFullName: request.user.fullName,
                                                              updatedAt: new Date(),
                                                              updatedByUserId: request.user.userId,
                                                              updatedByUserUsername: request.user.username,
                                                              updatedByUserFullName: request.user.fullName,
                                                              deleted: false,
                                                              value: value.toString(),
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

            return response.status(200).json({
                result: {
                    msg: "ok",
                },
            });
        } catch (error) {
            next(error);
        }
    },
);

export default router;
