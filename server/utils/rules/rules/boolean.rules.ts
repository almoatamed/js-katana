import type { Translate } from "../index.js";
import type { RuleBase } from "./base.js";

class booleanValidationRule implements RuleBase {
    set(value: any) {
        if (Math.floor(Number(value)) === 0 || Math.floor(Number(value)) === 1) {
            return Boolean(Math.floor(Number(value)));
        } else {
            return value;
        }
    }
    rule(value: any) {
        if (Math.floor(Number(value)) === 0 || Math.floor(Number(value)) === 1 || value === true || value === false) {
            return true;
        } else {
            return false;
        }
    }
    errorMsg = "";
    msg(field = "Field", _, t: Translate) {
        if (!this.errorMsg) {
            return `${field} ${t("is not a valid boolean")}`;
        } else {
            return this.errorMsg.replaceAll("[field]", field);
        }
    }
}

export type booleanValidatorParameters = null;
export interface booleanSetterParameters {
    obj: Object;
    key: String;
}
export default [
    // boolean
    booleanValidationRule,
];
