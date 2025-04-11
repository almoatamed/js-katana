import type { InternalGeneralOptions, Translate } from "../index.js";
import { RuleBase } from "./base.js";
class addressValidationRule implements RuleBase {
    errorMsg = "";
    max = 2000;

    msg = (field: string = "Field", options: InternalGeneralOptions, t: Translate) => {
        if (!this.errorMsg) {
            return `${field} ${t("is not a valid address")}`;
        } else {
            return this.errorMsg.replaceAll("[field]", field);
        }
    };

    rule(value: any, params: null, globalOptions: InternalGeneralOptions, t: Translate) {
        if (typeof value != "string") {
            this.errorMsg = "[field] must be a string";
            return false;
        }
        if (value.length > this.max) {
            this.errorMsg = `[field] cant be longer then ${this.max}`;
            return false;
        }
        return true;
    }
}

export type addressValidatorParameters = null;
export type addressSetterParameters = null;
export default [addressValidationRule];
