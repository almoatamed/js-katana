import type { Translate } from "../index.js";
import type { RuleBase } from "./base.js";

class usernameValidationRule implements RuleBase {
    maxLength = 250;
    rule(value: any) {
        try {
            return !!value.match(/^[a-zA-z_][a-zA-z0-9_\-]{3,}$/);
        } catch {
            return false;
        }
    }
    errorMsg = "";
    msg(field = "Field", _, t: Translate) {
        if (!this.errorMsg) {
            return `${field} ${t("is not a valid username")}`;
        } else {
            return this.errorMsg.replaceAll("[field]", field);
        }
    }
}

export type usernameValidatorParameters = null;
export type usernameSetterParameters = null;
export default [usernameValidationRule];
