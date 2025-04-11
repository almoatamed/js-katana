import fs from "fs";
const path = await import("path");

// rules
import { localLogDecorator } from "$/server/utils/log/index.js";
import ObjectError from "../ObjectError/index.js";

import type { ModulesType } from "$/server/modules/index.js";
import { resolveTs } from "../common/index.js";
import rootPaths from "../dynamicConfiguration/rootPaths.js";
import { t as T } from "../internationalization/index.js";
import type {
    GeneralOptions,
    MultirulesFunction,
    RuleName,
    RuleSetterParameters,
    RuleValidationParameters,
} from "./multirules.js";
const log = await localLogDecorator("rule utility", "yellow", true, "Info");

let client = null as null | ModulesType;
export function setClient(clientInstance: ModulesType) {
    client = clientInstance;
}

log("starting Building");
const rulesModules = {} as { [key: string]: { new (...args: any[]): Rule }[] };
const rulesFilesNames = fs.readdirSync(path.join(rootPaths.srcPath, "utils", "rules", "rules"));
for (const ruleFileName of rulesFilesNames) {
    const index = ruleFileName.endsWith(".rules.js")
        ? ruleFileName.indexOf(".rules.js")
        : ruleFileName.indexOf(".rules.ts");
    if (index != -1) {
        rulesModules[ruleFileName.slice(0, index)] = (await import(resolveTs(`./rules/${ruleFileName}`))).default;
    }
}
log("finished Building");
export type InternalGeneralOptions = import("./multirules.js").GeneralOptions & { multirule: MultirulesFunction };

export type Translate = (phrase: string) => string;

export type Rule = {
    statusCode?: number;
    recursive?: boolean;
    rule: (
        value: any,
        params: any[] | null,
        generalOptions: InternalGeneralOptions,
        t: Translate,
    ) => (boolean | undefined) | Promise<boolean | undefined>;
    msg: (field: string, options: InternalGeneralOptions, t: Translate) => string;
    set?: (
        value: any,
        sourceObj: {
            key: string;
            obj: any;
        },
    ) => any;
    client?: (ModulesType & { [key: string]: any }) | null;
};
export type PassedRule = {
    statusCode?: number;
    recursive?: boolean;
    rule: (
        value: any,
        generalOptions: InternalGeneralOptions,
        t: Translate,
    ) => (boolean | undefined) | Promise<boolean | undefined>;
    msg: (field: string, options: InternalGeneralOptions, t: Translate) => string;
    set: (value: any) => any;
    client?: (ModulesType & { [key: string]: any }) | null;
    [key: string]: any;
};

export interface Options {
    Rules: (RuleName | PassedRule)[];
    value: any;
    fieldName: string;
    args?: RuleValidationParameters;
    sourceObj?: RuleSetterParameters;
    recursive?: boolean;
    multirule?: MultirulesFunction | null;
    generalOptions?: import("./multirules.js").GeneralOptions | null;
}

export async function validate(
    Rules: (RuleName | PassedRule)[] | Options,
    value?: any,
    fieldName?: string,
    args?: RuleValidationParameters,
    sourceObj?: RuleSetterParameters,
    recursive: boolean = false,
    multirule: MultirulesFunction | null = null,
    generalOptions: GeneralOptions | null = null,
): Promise<{
    msg: string;
    valid: boolean;
}> {
    const t = (phrase: string): string => {
        return T(phrase, generalOptions?.lang) || phrase;
    };
    if (!Array.isArray(Rules)) {
        const options: Options = Rules;
        Rules = options.Rules;
        value = options.value;
        fieldName = options.fieldName;
        args = options.args;
        sourceObj = options.sourceObj;
        recursive = !!options.recursive;
        multirule = options.multirule || null;
        generalOptions = options.generalOptions || null;
    }

    if (!generalOptions) {
        generalOptions = {};
    }
    const internalGeneralOptions: InternalGeneralOptions = {
        ...generalOptions,
        multirule: multirule as any,
    };

    const rules = [] as (RuleName | PassedRule)[];
    if (
        typeof Rules == "string" ||
        (typeof Rules == "object" &&
            !Array.isArray(Rules) &&
            typeof (Rules as any)?.rule == "function" &&
            typeof (Rules as any)?.msg == "function")
    ) {
        rules.push(Rules);
    } else if (Array.isArray(Rules)) {
        rules.push(...Rules);
    } else {
        throw new ObjectError({
            statusCode: 500,
            error: {
                msg: t("invalid arguments at rule validation"),
                rules: Rules,
            },
        });
    }
    const requiredValidator = new rulesModules["required"][0]();
    requiredValidator.client = client;
    const isValueEmpty = !(await requiredValidator.rule(value, args?.["required"] as any, internalGeneralOptions, t));

    if (isValueEmpty) {
        if (rules.includes("required")) {
            throw new ObjectError({
                statusCode: 400,
                error: {
                    msg: await requiredValidator.msg(t(fieldName || "Field"), internalGeneralOptions, t),
                    name: `${t(fieldName as any) || t("element")} ${t("is required")}`,
                    value,
                },
            });
        } else {
            return {
                msg: "",
                valid: true,
            };
        }
    } else {
        for (const rule of rules) {
            if (typeof rule == "string") {
                if (rulesModules[rule]) {
                    const ruleCollection = rulesModules[rule];
                    for (const ruleClass of ruleCollection) {
                        const ruleValidator = new ruleClass(multirule) as Rule;
                        ruleValidator.client = client as ModulesType;
                        if (ruleValidator.recursive && recursive) {
                            throw new ObjectError({
                                statusCode: 500,
                                error: {
                                    msg: "Recursive Conflict on recursive rule",
                                    rule: rule,
                                    value: value,
                                },
                            });
                        }
                        const valid = await ruleValidator.rule(value, args?.[rule] as any, internalGeneralOptions, t);
                        if (!valid) {
                            throw new ObjectError({
                                statusCode: ruleValidator.statusCode || 400,
                                error: {
                                    msg: await ruleValidator.msg(
                                        t(fieldName as any) || "Field",
                                        internalGeneralOptions,
                                        t,
                                    ),
                                    name: `${t(fieldName as any) || t("element")} ${t("is not valid")}`,
                                    value,
                                    rule: rule,
                                },
                            });
                        }
                        // @ts-ignore
                        if (ruleValidator.set && sourceObj?.[rule]?.key && sourceObj?.[rule]?.obj) {
                            // @ts-ignore
                            sourceObj[rule].obj[sourceObj[rule].key as any] = await ruleValidator.set(
                                value,
                                sourceObj[rule] as any,
                            );
                            // @ts-ignore
                        } else if (ruleValidator.set && sourceObj?.[rule]?.set) {
                            // @ts-ignore
                            const result = await ruleValidator.set(value, sourceObj[rule] as any);
                            // @ts-ignore
                            await sourceObj?.[rule]?.set(result, value);
                        }
                    }
                } else {
                    log.warning("rule not found", rule);
                }
            } else if (typeof rule == "object" && typeof rule.rule == "function" && typeof rule.msg == "function") {
                if (rule.recursive && recursive) {
                    throw new ObjectError({
                        statusCode: 500,
                        error: {
                            msg: "Recursive Conflict on recursive rule",
                            rule: rule,
                            value: value,
                        },
                    });
                }
                const valid = await rule.rule(value, internalGeneralOptions, t);
                if (!valid) {
                    throw new ObjectError({
                        statusCode: rule.statusCode || 400,
                        error: {
                            msg: await rule.msg(t(fieldName as any) || "Field", internalGeneralOptions, t),
                            name: `${t(fieldName as any) || t("element")} ${t("is not valid")}`,
                            value,
                        },
                    });
                }
                if (rule.set) {
                    await rule.set(value);
                }
            } else {
                log("invalid rule, rule not found", rule);
            }
        }
        return { msg: "", valid: true };
    }
}

export default validate;
