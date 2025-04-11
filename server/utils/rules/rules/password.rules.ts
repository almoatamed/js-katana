import type { Translate } from "../index.js";
import type { RuleBase } from "./base.js";

export class passwordValidationRule implements RuleBase {
    rule(value: any) {
        try {
            return !!value.match(/^[a-zA-Z0-9_\-\!\@\#\$\%\^\&\*\(\)\+\<\>\.\?\,\;\|]{4,20}$/);
        } catch {
            return false;
        }
    }
    errorMsg = "";
    msg(field = "Field", _, t: Translate) {
        if (!this.errorMsg) {
            return `${field} ${t("is not a valid password")}`;
        } else {
            return this.errorMsg.replaceAll("[field]", field);
        }
    }
}

export type passwordValidatorParameters = null;
export type passwordSetterParameters = null;
export default [passwordValidationRule];
