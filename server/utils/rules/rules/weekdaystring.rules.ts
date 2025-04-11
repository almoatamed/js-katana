import type { Translate } from "../index.js";
import type { RuleBase } from "./base.js";
class weekdayStringValidationRule implements RuleBase {
    weekdayNumber = null as any;
    set() {
        return this.weekdayNumber;
    }
    weekdayMap = {
        sun: 0,
        sunday: 0,
        mon: 1,
        monday: 1,
        tue: 2,
        tuesday: 2,
        wed: 3,
        wednesday: 3,
        thu: 4,
        thursday: 4,
        fri: 5,
        friday: 5,
        sat: 6,
        saturday: 6,
    };
    rule(value, _, __, t: Translate) {
        if (typeof value == "number") {
            this.weekdayNumber = Math.floor(Number(value));
            if (this.weekdayNumber > 6 || this.weekdayNumber < 0) {
                this.errorMsg = t("week day index must be between 0 (sun) -> 6 (sat)");
                return false;
            }
        } else if (typeof value == "string") {
            this.weekdayNumber = Math.floor(Number(value));
            if (!Number.isNaN(this.weekdayNumber)) {
                if (this.weekdayNumber > 6 || this.weekdayNumber < 0) {
                    this.errorMsg = t("week day index must be between 0 (sun) -> 6 (sat)");
                    return false;
                }
            } else {
                this.weekdayNumber = this.weekdayMap[value];
                if (!this.weekdayNumber) {
                    this.errorMsg = `${t("week day string must be one of")}:\n${JSON.stringify(this.weekdayMap, null, 4)}`;
                    return false;
                }
            }
        } else {
            this.errorMsg = `[field] ${t("must be a string or a number as a week day")}`;
            return false;
        }
        return true;
    }
    errorMsg = "";
    msg(field, _, t: Translate) {
        if (!this.errorMsg) {
            return `${field} ${t("is not a valid weekday string")}`;
        } else {
            return this.errorMsg.replaceAll("[field]", field);
        }
    }
}

export type weekdaystringValidatorParameters = null;
export interface weekdaystringSetterParameters {
    obj: Object;
    key: String;
}
export default [weekdayStringValidationRule];
