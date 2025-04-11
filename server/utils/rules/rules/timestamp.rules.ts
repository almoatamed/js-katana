import type { Translate } from "../index.js";
import type { RuleBase } from "./base.js";

class timestampValidationRule implements RuleBase {
    rule(value: any, params: timestampValidatorParameters, _, t: Translate) {
        try {
            if (typeof value != "string" && typeof value != "number") {
                this.errorMsg = `[field] ${t("must be either a string or a number, given type is")} ${typeof value}`;
                return false;
            }
            value = Math.floor(Number(value));
            if (Number.isNaN(value)) {
                this.errorMsg = `[field] ${t("must be a valid number")}`;
                return false;
            }

            const date = new Date(value);
            if (date.toString() == "Invalid Date") {
                this.errorMsg = `[field] ${t("must be a valid timestamp")}`;
                return false;
            }
            if (!!params?.startdate) {
                params.startdate = new Date(params?.startdate);
            }
            if (!!params?.startdate && date.getTime() < params.startdate.getTime()) {
                this.errorMsg = `[field] ${t("must be after")} ${params.startdate.toString()}`;
                return false;
            }

            if (!!params?.endDate) {
                params.endDate = new Date(params?.endDate);
            }
            if (!!params?.endDate && date.getTime() > params.endDate.getTime()) {
                this.errorMsg = `[field] ${t("must be before")} ${params.endDate.toString()}`;
                return false;
            }

            return true;
        } catch (error: any) {
            console.log("Date validation Error", error);
            return false;
        }
    }
    errorMsg = "";
    msg(field = "Field", _, t: Translate) {
        if (!this.errorMsg) {
            return `${field} ${t("is not a valid timestamp")}`;
        } else {
            return this.errorMsg.replaceAll("[field]", field);
        }
    }
    set(value: any) {
        value = Math.floor(Number(value));
        const date = new Date(value);
        return date;
    }
}

export interface timestampValidatorParameters {
    startdate?: Date;
    endDate?: Date;
}
export interface timestampSetterParameters {
    obj: Object;
    key: String;
}
export default [timestampValidationRule];
