import type { Translate } from "../index.js";
import type { RuleBase } from "./base.js";

class requiredValidationRule implements RuleBase {
    rule(value: any) {
        if (typeof value == "object" && Array.isArray(value)) {
            if (value?.length == 0) {
                return false;
            } else {
                return true;
            }
        } else {
            if (typeof value === "undefined" || value === null || value === "" || Number.isNaN(value)) {
                return false;
            } else {
                return true;
            }
        }
    }
    errorMsg = "";
    msg(field = "Field", _, t: Translate) {
        if (!this.errorMsg) {
            return `${field} ${t("is Required")}`;
        } else {
            return this.errorMsg.replaceAll("[field]", field);
        }
    }
}

export type requiredValidatorParameters = null;
export type requiredSetterParameters = null;
export default [
    // required
    requiredValidationRule,
];
