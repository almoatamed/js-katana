import type { Translate } from "../index.js";
import type { RuleBase } from "./base.js";

class urlValidationRule implements RuleBase {
    maxLength = 250;
    rule(value: any) {
        try {
            return !!value
                .trim()
                .match(
                    /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/,
                );
        } catch {
            return false;
        }
    }
    errorMsg = "";
    msg(field = "Field", _, t: Translate) {
        if (!this.errorMsg) {
            return `${field} ${t("is not a valid url")}`;
        } else {
            return this.errorMsg.replaceAll("[field]", field);
        }
    }
}

export type urlValidatorParameters = null;
export type urlSetterParameters = null;
export default [urlValidationRule];
