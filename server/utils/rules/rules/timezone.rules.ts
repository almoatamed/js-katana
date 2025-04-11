import type { Translate } from "../index.js";
import type { RuleBase } from "./base.js";

const timezoneConstants = {
    min: -720,
    max: 840,
    default: 120,
    defaultName: "Africa/Tripoli",
};
class timestring implements RuleBase {
    timezoneNumber = null as any;

    rule(value: any, _, __, t: Translate) {
        if (typeof value == "number") {
            if (value > timezoneConstants.max || value < timezoneConstants.min) {
                this.errorMsg = `[field] ${t("as Timezone number in minutes must be between")} ${timezoneConstants.min} ${t("and")} ${timezoneConstants.max}`;
                return false;
            }
            this.timezoneNumber = value;
        } else {
            if (typeof value != "string") {
                this.errorMsg = `[field] ${t("as a timezone must be either a number (in minutes) or a string (HH:MM)")}`;
                return false;
            }

            const match = value.match(/^(\+|\-)?([0-9]*?)$/);
            if (match) {
                let sign = 1;
                if (match[1] === "-") {
                    sign = -1;
                }
                const timezoneNumber = sign * Math.floor(Number(match[2]));
                if (timezoneNumber > timezoneConstants.max || timezoneNumber < timezoneConstants.min) {
                    this.errorMsg = `[field] ${t("as Timezone number in minutes must be between")} ${timezoneConstants.min} ${t("and")} ${timezoneConstants.max}`;
                    return false;
                }
                this.timezoneNumber = timezoneNumber;
            } else {
                const parts = value.split(":");
                if (parts.length != 2) {
                    this.errorMsg = `[field] ${t("must be in the form of HH:MM")}`;
                    return false;
                }
                const HH = Math.floor(Number(parts[0]));
                if (Number.isNaN(HH) || HH > 23 || HH < 0) {
                    this.errorMsg = `[field] ${t("Hours must be between 00 -> 23")}`;
                    return false;
                }

                const MM = Math.floor(Number(parts[1]));
                if (Number.isNaN(MM) || MM > 59 || MM < 0) {
                    this.errorMsg = `[field] ${t("Minutes must be between 00 -> 23")}`;
                    return false;
                }

                const timezoneNumber = MM + 60 * HH;
                if (timezoneNumber > timezoneConstants.max || timezoneNumber < timezoneConstants.min) {
                    this.errorMsg = `[field] ${t("as Timezone number in minutes must be between")} ${timezoneConstants.min} ${t("and")} ${timezoneConstants.max}`;
                    return false;
                }
                this.timezoneNumber = timezoneNumber;
            }
        }

        return true;
    }
    errorMsg = "";
    msg(field = "Field", _, t: Translate) {
        if (!this.errorMsg) {
            return `${field} ${t("is not a valid timezone")}`;
        } else {
            return this.errorMsg.replaceAll("[field]", field);
        }
    }

    set() {
        return this.timezoneNumber;
    }
}

export type timezoneValidatorParameters = null;
export interface timezoneSetterParameters {
    obj: Object;
    key: String;
}
export default [timestring];
