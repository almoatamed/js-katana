;
import { Req } from "$/server/utils/express/index.js";
import ObjectError from "$/server/utils/ObjectError/index.js";
import fs from "fs";
import url from "url";

const utilsPath = url.fileURLToPath(new url.URL("../../../../../utils", import.meta.url));

export type LoadResourceCb = (request?: Req) => (string | number)[];
export type RequestLookupCb = (request: Req) => string | number;

export type DynamicAuthorityDefinition = {
    model?: import("$/server/utils/JsDoc/assets/models.js").Model;
    fetchApi: string;
    loadResourceCb?: LoadResourceCb;
    displayKey: string;
    idKey: string;
    requestLookupCb: RequestLookupCb;
    displayDescription: string;
    dynamicAuthorityKey: string;
    displayName: string;
    label: string;
    idType: "number" | "string";
    values?: (string | number)[]
};

export type AuthorityDefinition = {
    keyName: string;
    parentKeyName?: string;
    displayName: string;
    displayDescription: string;
    dynamicAuthorities?: Array<DynamicAuthorityDefinition>;
};

class Authorities {
    authorities = {} as {
        [key: string]: AuthorityDefinition
    };
    authoritiesKeys: string[] = [];
    noMore: Boolean = false;

    run() {
        this.noMore = true;
    }
    add(authority: AuthorityDefinition): void {
        if (this.noMore) {
            throw new ObjectError({
                statusCode: 500,
                error: {
                    msg: "you can not add authorities after startup",
                },
            });
        }
        if (!authority?.keyName) {
            throw {
                msg: "authority doesnt have key name",
            };
        }
        let dynamicAuthorities: null | {
            [key: string]: DynamicAuthorityDefinition
        } = null;
        if (Object.values(authority?.dynamicAuthorities || {})?.length) {
            dynamicAuthorities = {};
            if (typeof authority.dynamicAuthorities != "object") {
                throw {
                    msg: "dynamic authority is optional, but if provided must be either and object or an array",
                    authority,
                };
            }
            const providedDynamicAuthorities = Object.values(authority.dynamicAuthorities);
            for (const dynamicAuthority of providedDynamicAuthorities) {
                if (typeof dynamicAuthority != "object") {
                    throw {
                        msg: "Each Dynamic authority must be object",
                        authority,
                        dynamicAuthority,
                    };
                }

                if (!dynamicAuthority.fetchApi || (!dynamicAuthority.model && !dynamicAuthority.loadResourceCb)) {
                    throw {
                        msg: "Each Dynamic authority must either fetch api and model name and model",
                        authority,
                        dynamicAuthority,
                    };
                }
                if (!dynamicAuthority.displayKey) {
                    throw {
                        msg: "Each Dynamic authority must have display key",
                        authority,
                        dynamicAuthority,
                    };
                }
                if (!dynamicAuthority.idKey) {
                    throw {
                        msg: "Each Dynamic authority must have id key",
                        authority,
                        dynamicAuthority,
                    };
                }
                if (!dynamicAuthority.requestLookupCb) {
                    throw {
                        msg: "Each Dynamic authority must have default eval string",
                        authority,
                        dynamicAuthority,
                    };
                }
                if (!dynamicAuthority.dynamicAuthorityKey) {
                    throw {
                        msg: "Each Dynamic authority must have default dynamic authority key",
                        authority,
                        dynamicAuthority,
                    };
                }
                if (!dynamicAuthority.displayName) {
                    throw {
                        msg: "Each Dynamic authority must have Name to illustrate it",
                        authority,
                        dynamicAuthority,
                    };
                }
                if (!dynamicAuthority.displayDescription) {
                    throw {
                        msg: "Each Dynamic authority must Description of its functionality",
                        authority,
                        dynamicAuthority,
                    };
                }
                if (!dynamicAuthority.label) {
                    throw {
                        msg: "Each Dynamic authority must have a label",
                        authority,
                        dynamicAuthority,
                    };
                }
                if (!dynamicAuthority.idType) {
                    throw {
                        msg: "Each Dynamic authority must have a id type",
                        authority,
                        dynamicAuthority,
                    };
                }

                dynamicAuthorities[dynamicAuthority.dynamicAuthorityKey] = {
                    dynamicAuthorityKey: dynamicAuthority.dynamicAuthorityKey,
                    requestLookupCb: dynamicAuthority.requestLookupCb,
                    displayKey: dynamicAuthority.displayKey,
                    displayName: dynamicAuthority.displayName,
                    displayDescription: dynamicAuthority.displayDescription,
                    label: dynamicAuthority.label,
                    idKey: dynamicAuthority.idKey,
                    idType: dynamicAuthority.idType,
                    fetchApi: dynamicAuthority.fetchApi,
                    model: dynamicAuthority.model,
                };
            }
        }

        let storedAuthority = this.authorities[authority.keyName];
        if (!storedAuthority) {
            this.authoritiesKeys.push(authority.keyName);
            Object.defineProperty(this.authorities, authority.keyName, {
                get() {
                    return authority;
                },
                set() {
                    throw new ObjectError({
                        statusCode: 500,
                        error: {
                            msg: "Use set function to add authorities, and only in startup",
                        },
                    });
                },
            });
        }
        const keys = this.authoritiesKeys.map((k) => `"${String(k)}"`).join("|");
        fs.writeFileSync(
            `${utilsPath}/JsDoc/assets/authorities.js`,
            `
/**
 * @typedef {${keys}} AuthoritiesNames
* 
*/
export default {}
        `,
        );
    }
    getAll() {
        const json: any = {};
        for (const key of this.authoritiesKeys) {
            json[key] = this.authorities[key];
        }
        return json;
    }
}
export { Authorities };
const authorities = new Authorities();

const runSeedAuthorities = (await import("$/server/modules/User/static/utils/authorities/buildAuthorities.js")).seedAuthorities;
await runSeedAuthorities(authorities);

export default authorities;
