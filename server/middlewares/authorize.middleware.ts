import { Req, Requester } from "$/server/utils/express/index.js";
import type { AuthoritiesNames } from "../utils/JsDoc/assets/authorities.js";
export { AuthoritiesNames };
const common = (await import("$/server/utils/common/index.js")).default;
const cluster = (await import("cluster")).default;

const authorities = (await import("$/server/modules/User/static/utils/authorities/index.js")).default;

const getUserAuthoritiesSource = (user: Requester) => {
    const userAuthoritiesSource = user.authorizationProfile?.profileAuthorities || user.userAuthorities;
    return userAuthoritiesSource;
};

function hasAuthority(authority: Authority | AuthoritiesNames, request: Req): boolean {
    const user = request.user;
    return userHasAuthority(authority, user, request);
}

export function userHasAuthority(authority: Authority | AuthoritiesNames, user: Requester, request?: Req): boolean {
    if (user.username == "admin" || user.userType == "ADMIN") {
        return true;
    }
    const keyName = typeof authority != "string" ? authority?.keyName : authority;

    if (!user.active) {
        return false;
    }

    const userAuthoritiesSource = getUserAuthoritiesSource(user);
    const userAuthority = userAuthoritiesSource.find((userAuthority) => userAuthority.keyName == keyName);
    if (!userAuthority) {
        return false;
    }
    if (userAuthority.all || !authorities.authorities[keyName].dynamicAuthorities) {
        return true;
    }

    const dynamicAuthoritiesSource =
        typeof authority != "string"
            ? Object.values(authority?.dynamicAuthorities || {})
            : Object.values(authorities.authorities[keyName as string].dynamicAuthorities || {});

    for (const dynamicAuthority of dynamicAuthoritiesSource) {
        const originalDynamicAuthority = Object.values(authorities.authorities[keyName].dynamicAuthorities).find(
            (da: any) => da.dynamicAuthorityKey == dynamicAuthority.dynamicAuthorityKey,
        );

        if (!originalDynamicAuthority) {
            console.warn("Dynamic Authority not found", dynamicAuthority.dynamicAuthorityKey);
            continue;
        }

        const userDynamicAuthority = userAuthority.dynamicAuthorities.find(
            (da) => da.dynamicAuthorityKey == originalDynamicAuthority!.dynamicAuthorityKey,
        );
        if (!userDynamicAuthority) {
            return false;
        }
        if (userDynamicAuthority?.all) {
            continue;
        }

        const requiredValues = dynamicAuthority?.values;

        if (requiredValues?.length) {
            if (
                !userDynamicAuthority.dynamicAuthorityValues.some((udv) => {
                    return requiredValues.some((dv) => {
                        return dv == udv.value;
                    });
                })
            ) {
                return false;
            }
        } else if (request) {
            const requestLookupCb =
                dynamicAuthority.requestLookupCb ||
                (typeof authority != "string" &&
                    authority?.dynamicAuthorities?.[originalDynamicAuthority.dynamicAuthorityKey]?.requestLookupCb) ||
                originalDynamicAuthority.requestLookupCb;
            const value = typeof requestLookupCb == "function" ? requestLookupCb(request) : [];
            if (Array.isArray(value)) {
                if (
                    !userDynamicAuthority.dynamicAuthorityValues.some((udv) => {
                        return value.some((dv) => {
                            return dv == udv.value;
                        });
                    })
                ) {
                    return false;
                }
            } else {
                if (!userDynamicAuthority.dynamicAuthorityValues.find((v) => v.value == value)) {
                    return false;
                }
            }
        }
    }
    return true;
}

export function validateAuthority(authority: Authority | AuthoritiesNames, request: Req): void {
    if (!hasAuthority(authority, request)) {
        throw {
            error: {
                msg: "This Action Not Authorized",
                name: "Not Authorized",
            },
            statusCode: 403,
        };
    }
}

export function validateUserAuthority(authority: Authority | AuthoritiesNames, user: Requester): void {
    if (!userHasAuthority(authority, user)) {
        throw {
            error: {
                msg: "This Action Not Authorized",
                name: "Not Authorized",
            },
            statusCode: 401,
        };
    }
}

interface DynamicAuthorities {
    values?: Array<string | number>;
    requestLookupCb?: string;
    dynamicAuthorityKey?: string;
}

interface Authority {
    keyName: AuthoritiesNames;
    dynamicAuthorities?: { [key: string]: DynamicAuthorities };
}

type ArrayAuthorities = Array<Authority>;
export interface AuthorizationOption {
    or?: (Authority | AuthoritiesNames)[];
    and?: (Authority | AuthoritiesNames)[];
}

export interface AuthorizationOptions {
    url: string;
    allow?: AuthorizationOption;
    reject?: AuthorizationOption;
}

export default {
    validateAuthority,
    hasAuthority,

    /**
     *
     * @param {AuthorizationOptions} options
     * @returns
     */
    authorize(options: AuthorizationOptions) {
        // make sure that the options is valid

        const authoritiesKeyNamesList = [] as (Authority | AuthoritiesNames)[];
        if (options?.allow?.or?.length) {
            authoritiesKeyNamesList.push(...options?.allow?.or);
        }
        if (options?.allow?.and?.length) {
            authoritiesKeyNamesList.push(...options?.allow?.and);
        }
        if (options?.reject?.or?.length) {
            authoritiesKeyNamesList.push(...options?.reject?.or);
        }
        if (options?.reject?.and?.length) {
            authoritiesKeyNamesList.push(...options?.reject?.and);
        }

        if (!options.url) {
            throw {
                msg: "url is not given",
                options,
            };
        }
        const apiPath = common.metaUrlToRouterRelativePath(options.url);
        if (cluster.isPrimary) {
            for (const authority of authoritiesKeyNamesList) {
                const keyName = typeof authority != "string" ? authority?.keyName : authority;
                if (!authorities.authorities[keyName]) {
                    console.log(authorities.authorities["updateUser"]);
                    throw {
                        msg: "Authority Key Name not found",
                        keyName: keyName,
                        authoritiesKeyNamesList,
                        options,
                    };
                }
            }
        }

        return async function authorize(request: Req, response, next) {
            try {
                if (request.user.username == "admin" || request.user.userType == "ADMIN") {
                    return next();
                }
                if (
                    !options.allow?.or?.length &&
                    !options.allow?.and?.length &&
                    !options.reject?.or?.length &&
                    !options.reject?.and?.length
                ) {
                    return next();
                }

                const actionNotAuthorized = {
                    error: {
                        msg: "This Action Not Authorized",
                        name: "Not Authorized",
                    },
                    statusCode: 401,
                };

                if (options.allow) {
                    if (options.allow.or?.length) {
                        if (options.allow.or.some((authority) => hasAuthority(authority, request))) {
                            return next();
                        }
                    }

                    if (options.allow.and?.length) {
                        if (options.allow.and.every((authority) => hasAuthority(authority, request))) {
                            return next();
                        }
                    }
                    return next(actionNotAuthorized);
                } else if (options.reject) {
                    if (options.reject.or?.length) {
                        if (options.reject.or.some((authority) => hasAuthority(authority, request))) {
                            return next(actionNotAuthorized);
                        }
                    }

                    if (options.reject.and?.length) {
                        if (options.reject.and.every((authority) => hasAuthority(authority, request))) {
                            next(actionNotAuthorized);
                        }
                    }
                    return next();
                }

                return next(actionNotAuthorized);
            } catch (error: any) {
                console.log(error);
                return next(error);
            }
        };
    },
};
