import type { Translate } from "../index.js";
import type { RuleBase } from "./base.js";

class nameValidationRule implements RuleBase {
    rule(value: any, _, __, t: Translate) {
        try {
            return !!value.trim().match(/^(?:\p{Letter}{2,20})(?:\p{Z}{1,2}\p{Letter}{1,20}){1,3}$/iu);
        } catch {
            return false;
        }
    }
    errorMsg = "";
    msg(field = "Field", _, t: Translate) {
        if (!this.errorMsg) {
            return `${field} ${t("is not a valid name")}`;
        } else {
            return this.errorMsg.replaceAll("[field]", field);
        }
    }
}

export type nameValidatorParameters = null;
export type nameSetterParameters = null;
export default [nameValidationRule];
