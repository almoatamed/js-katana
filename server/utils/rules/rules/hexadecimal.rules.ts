import type { RuleBase } from "./base.js";

class addressValidationRule implements RuleBase {
    errorMsg = "";

    values = [];
    allowedCase: hexadecimalValidatorParameters["allowedCharacters"] = "Both";
    msg(field = "Field") {
        if (!this.errorMsg) {
            return `${field} is not a valid hexadecimal ${
                this.allowedCase == "LowerCase" || this.allowedCase == "UpperCase" ? this.allowedCase : ""
            } string`;
        } else {
            return this.errorMsg.replaceAll("[field]", field);
        }
    }

    rule(value: any, params: hexadecimalValidatorParameters) {
        if (typeof value != "string") {
            this.errorMsg = "[field] is not a string";
            return false;
        }
        if (!params) {
            params = {};
        }
        if (!params?.allowedCharacters) {
            params.allowedCharacters = "Both";
        }

        this.allowedCase = params.allowedCharacters;
        if (params?.allowedCharacters == "Both") {
            return !!value.match(/^[0-9abcdefABCDEF]{0,}$/);
        } else if (params.allowedCharacters == "LowerCase") {
            return !!value.match(/^[0-9abcdef]{0,}$/);
        } else if (params.allowedCharacters == "UpperCase") {
            return !!value.match(/^[0-9ABCDEF]{0,}$/);
        }
        return true;
    }
}

export type hexadecimalValidatorParameters = { allowedCharacters?: "UpperCase" | "LowerCase" | "Both" };
export type hexadecimalSetterParameters = null;
export default [addressValidationRule];
