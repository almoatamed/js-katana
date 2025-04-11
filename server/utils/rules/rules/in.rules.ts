import ObjectError from "../../ObjectError/index.js";
import type { Translate } from "../index.js";
import type { RuleBase } from "./base.js";

class addressValidationRule implements RuleBase {
    errorMsg = "";

    values = [] as (string | number)[];
    msg(field = "Field", _, t: Translate) {
        if (!this.errorMsg) {
            return `${field} ${t("is not a value in the given probable values")} ${this.values.length > 50 ? `, ${t("values are too long to be provided in this error message")}` : this.values}`;
        } else {
            return this.errorMsg.replaceAll("[field]", field);
        }
    }
    rule(value: any, params: inValidatorParameters, _, t: Translate) {
        if (!["number", "string"].includes(typeof value)) {
            this.errorMsg = `[field] ${t("is not a number or string")}`;
            return false;
        }
        if (!params) {
            throw new ObjectError({
                statusCode: 500,
                error: {
                    msg: `${t("values to check against is not provided for `in` rule, ")}` + params,
                },
            });
        }
        this.values = Array.isArray(params) ? params : Object.keys(params);
        if (Array.isArray(params)) {
            if (!params.includes(value)) {
                return false;
            }
        } else {
            if (!params[value]) {
                return false;
            }
        }
        return true;
    }
}

export type inValidatorParameters =
    | (string | number)[]
    | {
          [key: string | number]: any;
      };
export type inSetterParameters = null;
export default [addressValidationRule];
