import { isNumber, recursiveSelect } from "../../common/index.js";
import type { InternalGeneralOptions, Translate } from "../index.js";
import type { RuleName, RuleSetterParameters, RuleValidationParameters } from "../multirules.js";
import type { RuleBase } from "./base.js";

class arrayValidationRule implements RuleBase {
    errorMsg = "";
    msg(field = "Field", GlobalOptions: InternalGeneralOptions, t: Translate) {
        if (!this.errorMsg) {
            return `${field} ${t("is not a valid array")}`;
        } else {
            return this.errorMsg.replaceAll("[field]", field);
        }
    }

    async rule(
        value: any,
        args: arrayValidatorParameters,
        generalOptions: import("../index.js").InternalGeneralOptions,
        t: Translate,
    ) {
        if (!Array.isArray(value)) {
            return false;
        } else {
            if (Array.isArray(args) && args.length) {
                return value.every((el) => args.includes(typeof el as any));
            } else if (typeof args == "object" && !Array.isArray(args)) {
                const options = args;

                if (Array.isArray(options.allowedTypes) && options.allowedTypes?.length) {
                    const allowedTypes = options.allowedTypes;
                    if (!value.every((el) => allowedTypes.includes(typeof el as any))) {
                        this.errorMsg =
                            `${t("there is invalid types in")} [field], ${t("expected types are")}: ` +
                            String(allowedTypes);
                        return false;
                    }
                }

                if (isNumber(options.length)) {
                    if (options.length != value.length) {
                        this.errorMsg = `[field] must be of length ${options.length}`;
                        return false;
                    }
                }

                if (isNumber(options.maxLength)) {
                    if (options.maxLength < value.length) {
                        this.errorMsg = `[field] must be less than or equals ${options.length} in length`;
                        return false;
                    }
                }

                if (isNumber(options.minLength)) {
                    if (options.minLength > value.length) {
                        this.errorMsg = `[field] must be more than or equals ${options.length} in length`;
                        return false;
                    }
                }

                if (options.uniqueValues) {
                    const set = [...new Set(value)];
                    if (set.length != value.length) {
                        this.errorMsg = `${t("there is duplicate values in")} [field]`;
                        return false;
                    }
                }

                if (options.applyRules?.length) {
                    const Rules = options.applyRules;
                    await Promise.all(
                        value?.map(async (item, index) => {
                            const rules = [] as any[];
                            for (const rule of Rules) {
                                const ruleCopy = [...rule];
                                if (typeof ruleCopy[1] == "string") {
                                    ruleCopy[1] = recursiveSelect(ruleCopy[1], item);
                                } else {
                                    ruleCopy[1] = item;
                                }
                                ruleCopy[2] = `item index ${index}: ${rule[2]}`;
                                ruleCopy[3] = typeof rule[3] == "function" ? rule[3](item) : rule[3];
                                rules.push(ruleCopy);
                            }

                            await generalOptions.multirule(rules, generalOptions, true);
                        }),
                    );
                }
                return true;
            } else {
                return true;
            }
        }
    }
}

export type AllowedTypes = ("object" | "string" | "number" | "undefined")[];

export type ArrayValidationOptions = {
    allowedTypes?: AllowedTypes;
    length?: number;
    minLength?: number;
    maxLength?: number;
    uniqueValues?: boolean;
    applyRules?: [
        Array<RuleName>,
        any,
        String,
        (RuleValidationParameters | ((target: any) => RuleValidationParameters))?,
        RuleSetterParameters?,
    ][];
};

export type arrayValidatorParameters = AllowedTypes | ArrayValidationOptions;
export type arraySetterParameters = null;
export default [arrayValidationRule];
