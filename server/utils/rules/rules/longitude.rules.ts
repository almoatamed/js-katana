import type { Translate } from "../index.js";
import type { RuleBase } from "./base.js";

class longitudeValidationRule implements RuleBase {
    rule(value: any, _, __, t: Translate) {
        if (typeof value != "string" && typeof value != "number") {
            this.errorMsg = t("Longitude must be either a string or number");
            return false;
        }
        const longitude = Number(value);
        if (!longitude) {
            this.errorMsg = t("longitude must be a valid float number");
            return false;
        }
        if (longitude > 180 || longitude < -180) {
            this.errorMsg = t("longitude must be between -180.0 and 180.0 degree");
            return false;
        }
        return true;
    }
    errorMsg = "";
    msg(field = "Field", _, t: Translate) {
        if (!this.errorMsg) {
            return `${field} ${t("is not a valid longitude")}`;
        } else {
            return this.errorMsg.replaceAll("[field]", field);
        }
    }
}

export type longitudeValidatorParameters = null;
export type longitudeSetterParameters = null;
export default [longitudeValidationRule];
