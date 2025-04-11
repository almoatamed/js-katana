import type { Translate } from "../index.js";
import type { RuleBase } from "./base.js";

class timestring implements RuleBase {
    time = {} as any;
    rule(value: any,__,  _,t: Translate ) {
        if (typeof value != "string") {
            this.errorMsg = `[field] ${t("as Time-String must be a string in the form of HH:MM:SS")}`;
            return false;
        }
        const parts = value.split(":");
        if (parts.length != 3) {
            this.errorMsg = `[field] ${t("must be in the form of HH:MM:SS")}`;
            return false;
        }
        const HH = parseInt(parts[0]);
        if (Number.isNaN(HH) || HH > 23 || HH < 0) {
            this.errorMsg = `[field] ${t("Hours must be between 00 -> 23")}`;
            return false;
        }

        const MM = parseInt(parts[1]);
        if (Number.isNaN(MM) || MM > 59 || MM < 0) {
            this.errorMsg = `[field] ${t("Minutes must be between 00 -> 23")}`;
            return false;
        }

        const SS = parseInt(parts[2]);
        if (Number.isNaN(SS) || SS > 59 || SS < 0) {
            this.errorMsg = `[field] ${t("Seconds must be between 00 -> 23")}`;
            return false;
        }

        this.time = {
            HH: HH,
            MM: MM,
            SS: SS,
        };

        return true;
    }
    errorMsg = "";
    msg(field = "Field", _, t: Translate) {
        if (!this.errorMsg) {
            return `${field} ${t("is not a valid timestring")}`;
        } else {
            return this.errorMsg.replaceAll("[field]", field);
        }
    }

    set() {
        return this.time;
    }
}

export type timestringValidatorParameters = null;
export interface timestringSetterParameters {
    obj: Object;
    key: string;
}
export default [timestring];
