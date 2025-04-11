import type { Translate } from "../index.js";
import type { RuleBase } from "./base.js";

class latitudeValidationRule implements RuleBase {
    rule(value: any, _, __, t: Translate) {
        if (typeof value != "string" && typeof value != "number") {
            this.errorMsg = `${t("Latitude must be either a string or number")}`;
            return false;
        }
        const latitude = Number(value);
        if (!latitude) {
            this.errorMsg = t("latitude must be a valid float number");
            return false;
        }
        if (latitude > 90 || latitude < -90) {
            this.errorMsg = t("latitude must be between -90.0 and 90.0 degree");
            return false;
        }
        return true;
    }
    errorMsg = "";
    msg(field = "Field", _, t: Translate) {
        if (!this.errorMsg) {
            return `${field} ${t("is not a valid latitude")}`;
        } else {
            return this.errorMsg.replaceAll("[field]", field);
        }
    }
}

export type latitudeValidatorParameters = null;
export type latitudeSetterParameters = null;
export default [latitudeValidationRule];

export { latitudeValidationRule };
