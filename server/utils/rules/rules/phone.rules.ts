import type { Translate } from "../index.js";
import type { RuleBase } from "./base.js";

class phoneValidationRule implements RuleBase {
    rule(value: any) {
        try {
            return !!value.trim().match(/^((\+|00)\s?\d{1,3}\s?)?(\(?\d{2,3}\)?)(\-|\s)?(\d{3}(\-|\s)?\d{4})$/);
        } catch {
            return false;
        }
    }
    errorMsg = "";
    msg(field = "Field", _, t: Translate) {
        if (!this.errorMsg) {
            return `${field} ${t("is not a valid Phone Number")}`;
        } else {
            return this.errorMsg.replaceAll("[field]", field);
        }
    }
}

export type phoneValidatorParameters = null;
export type phoneSetterParameters = null;
export default [phoneValidationRule];
