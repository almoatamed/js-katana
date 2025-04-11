import { Prisma } from "../../../../../../../../prisma/client/index.js";

const client = (await import("$/server/utils/database/prisma.js")).default;

const auth = (await import("$/server/middlewares/user.middleware.js")).default.auth;
const authorize = (await import("$/server/middlewares/authorize.middleware.js")).default.authorize;

const multirule = (await import("../../../../../../../utils/rules/multirules.js")).default;

;

const express = (await import("$/server/utils/express/index.js")).default;

// authorities
const authorities = (await import("$/server/modules/User/static/utils/authorities/index.js")).default;

const router = express.Router();

router.post(
    "/",
    auth,
    authorize({
        url: import.meta.url,
        allow: { or: [] },
    }),
    async (request, response, next) => {
        try {
            // validation

            /**
             * @type {import("$/server/utils/rules/multirules.js").Multirules }
             */
            const validationList: import("$/server/utils/rules/multirules.js").Multirules = [
                [
                    ["required", "number", "exists"],
                    request.body.profileId,
                    "Profile ID",
                    {
                        number: {
                            min: 0,
                        },
                        exists: {
                            model: "authoritiesProfile",
                            idKey: "profileId",
                            parseInt: true,
                        },
                    },
                ],
                [
                    ["required", "title", "unique"],
                    request.body.name,
                    "Name",
                    {
                        unique: {
                            model: "authoritiesProfile",
                            uniqueKey: "name",
                            exceptId: Math.floor(request.body.profileId),
                            idKey: "profileId",
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
            ];
            await multirule(validationList);

            const authoritiesList = [] as any[];
            for (const authority of request.body.authorities || []) {
                // validate the authority
                /**
                 * 1- check if the authority key exists, if not throw--
                 * 2- if authority.all continue--
                 * 3- check if the authority has any dynamic authorities, if not set the authority.all to true and continue --
                 * 4- for each dynamic authority in the source authority.dynamicAuthorities
                 *    1- make sure that the dynamic authority key is in the authority.dynamicAuthoritiesArray, if not throw --
                 *    2- if dynamic authority.all continue --
                 *    3- make sure the values array is given and it has list of values that either string, or number --
                 *    4- for each element in the values array --
                 *       1- make sure that the value exists in the source model, if not throw, --
                 *
                 *
                 */

                const authorityBody: Prisma.UserAuthorityCreateInput = {
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
                    authoritiesList.push({ authorityBody: authorityBody, dynamicAuthoritiesList: null });
                    continue;
                }

                const dynamicAuthoritiesList = [] as any[];
                for (const dynamicAuthority of Object.values(
                    authorities.authorities[authority.keyName].dynamicAuthorities || [],
                )) {
                    /**
                     * @type {Prisma.usersDynamicAuthoritiesCreateInput}
                     */
                    const dynamicAuthorityBody: Prisma.UserDynamicAuthorityCreateInput = {
                        dynamicAuthorityKey: "",
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
                        (profileDynamicAuthority) =>
                            profileDynamicAuthority.dynamicAuthorityKey == dynamicAuthority.dynamicAuthorityKey,
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

                    dynamicAuthorityBody.dynamicAuthorityKey = dynamicAuthority.dynamicAuthorityKey;

                    if (profileDynamicAuthority.all) {
                        dynamicAuthorityBody.all = true;
                        dynamicAuthoritiesList.push({
                            dynamicAuthorityBody: dynamicAuthorityBody,
                            values: null,
                        });
                        continue;
                    }

                    // make sure tha the values list is provided
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
                        let item = null as null | number | string | undefined;
                        if (dynamicAuthority.model) {
                            item = await (client as any)[dynamicAuthority.model].findFirst({
                                where: {
                                    deleted: false,
                                    [dynamicAuthority.idKey]:
                                        dynamicAuthority.idType == "number" ? Math.floor(Number(value)) : value,
                                },
                            });
                        } else if (dynamicAuthority.loadResourceCb) {
                            const source = dynamicAuthority.loadResourceCb(request);
                            item = source.find(
                                (item) =>
                                    item[dynamicAuthority.idKey] ==
                                    (dynamicAuthority.idType == "number" ? Math.floor(Number(value)) : value),
                            );
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

                    dynamicAuthoritiesList.push({
                        dynamicAuthorityBody: dynamicAuthorityBody,
                        values: profileDynamicAuthority.values,
                    });
                }
                authoritiesList.push({
                    authorityBody: authorityBody,
                    dynamicAuthoritiesList: dynamicAuthoritiesList,
                });
            }

            // insert them
            /**
             * 1- delete the old authorities
             * 2- for each authority
             *    1- insert the authority
             *    2- for each dynamic authority
             *       1- insert it into the authorities dynamic authorities with the values mapped
             */
            const profile = await client.authoritiesProfile.update({
                where: {
                    profileId: Math.floor(request.body.profileId),
                },
                data: {
                    name: request.body.name || undefined,
                    defaultHomePageName: request.body.to || null,

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
            await client.profileAuthority.updateMany({
                where: {
                    deleted: false,
                    profileId: Math.floor(request.body.profileId),
                },
                data: {
                    updatedAt: new Date(),
                    updatedByUserId: request.user.userId,
                    updatedByUserUsername: request.user.username,
                    updatedByUserFullName: request.user.fullName,
                    deleted: true,
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
                if (authority.dynamicAuthoritiesList?.length) {
                    for (const dynamicAuthority of authority.dynamicAuthoritiesList) {
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

            request.body.profile = profile;
            
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
