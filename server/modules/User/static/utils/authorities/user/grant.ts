;
import ObjectError from "$/server/utils/ObjectError/index.js";
import { Requester } from "../../../../../../utils/express/index.js";
import requesterFields from "../../../../../utils/requesterFields/index.js";
import validate from "../validateAuthoritiesRequest.js";

const multirules = (await import("../../../../../../utils/rules/multirules.js")).default;
const client = (await import("$/server/utils/database/prisma.js")).default;

export type AuthoritiesNames = import("$/server/middlewares/authorize.middleware.js").AuthoritiesNames;

export interface DynamicAuthority {
    all?: Boolean;
    dynamicAuthorityKey: String;
    values?: Array<Number | String> | null;
}

export interface AuthorityRequest {
    keyName: AuthoritiesNames;
    all?: boolean;
    dynamicAuthoritiesArray?: Array<DynamicAuthority>;
}

export type AuthoritiesRequest = Array<AuthorityRequest>;

export type Options = {
    userId?: number;
    overwrite?: boolean;
    asUserId?: number;
    asProfileId?: number;
    requesterUser?: Requester;
    authorities: AuthoritiesRequest;
    [key: string]: any;
};

export default async function grant(options: Options): Promise<void> {
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
        [
            ["array"],
            options.authorities,
            "Authorities",
            {
                array: ["object"],
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
    /**
     * @type {import("$/prisma/client/index.js").users}
     */
    const user = options.user;

    if (user.authorizationProfileId) {
        throw new ObjectError({
            statusCode: 400,
            error: {
                msg: "Cannot grant this user authorities, he is using authorities profile",
                authoritiesProfileId: user.authorizationProfileId,
            },
        });
    }

    const processedAuthorities = await validate({
        authorities: options.authorities,
        requesterUser: options.requesterUser,
        asProfileId: options.asProfileId,
        asUserId: options.asUserId,
    });

    // insertion
    await client.$transaction(async (client) => {
        await client.userAuthority.updateMany({
            where: {
                userId: user.userId,
                keyName: options.overwrite
                    ? undefined
                    : {
                          in: processedAuthorities.map((pa) => pa.body.keyName),
                      },
            },
            data: {
                deleted: true,
            },
        });

        for (const authority of processedAuthorities) {
            const userAuthority = await client.userAuthority.create({
                data: {
                    ...(authority.body as any),
                    user: {
                        connect: {
                            userId: user.userId,
                        },
                    },
                },
            });
            if (authority.dynamicAuthorities?.length) {
                for (const dynamicAuthority of authority.dynamicAuthorities) {
                    await client.userAuthority.update({
                        where: {
                            authorityId: userAuthority.authorityId,
                        },
                        data: {
                            dynamicAuthorities: {
                                create: {
                                    ...dynamicAuthority.body,
                                    dynamicAuthorityValues: (dynamicAuthority.body.all
                                        ? undefined
                                        : {
                                              createMany: {
                                                  data: dynamicAuthority.values?.map((value) => {
                                                      return {
                                                          ...requesterFields.createMany(options.requesterUser),
                                                          deleted: false,
                                                          value: value,
                                                      };
                                                  }),
                                              },
                                          }) as any,
                                },
                            },
                        },
                    });
                }
            }
        }
    });
}
