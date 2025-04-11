import { Translate } from "../index.js";
import type { RuleBase } from "./base.js";

class titleValidationRule implements RuleBase {
    maxLength = 250;

    rule(value: any, params: titleValidatorParameters, _, t: Translate) {
        if (typeof value != "string") {
            this.errorMsg = `[field] ${t("must be a string")}`;
            return false;
        }
        if (!(params?.max === false) && value.length > (params?.max || this.maxLength)) {
            this.errorMsg = `[field] ${t("must be less then")} ${params?.max || this.maxLength} ${t("in length")}`;
            return false;
        }
        if (params?.min && value.length < params?.min) {
            this.errorMsg = `[field] ${t("must be more then")} ${params?.min} ${t("in length")}`;
            return false;
        }
        if (params?.eq && value.length != params?.eq) {
            this.errorMsg = `[field] ${t("must be equal to")} ${params?.eq} ${t("in length")}`;
            return false;
        }
        if (
            params?.reserved?.length
        ) {
            if (params?.sensitiveCaseReserved && params.reserved.some((item) => item == value)) {
                this.errorMsg = `[field] ${t("must not be one the following values (sensitive case)")} ${String(params.reserved)}`;
                return false;
            } else if (!params?.sensitiveCaseReserved && params.reserved.some((item) => item.toUpperCase() == value.toUpperCase())) {
                this.errorMsg = `[field] ${t("must not be one the following values (insensitive case)")} ${String(params.reserved)}`;
                return false;
            }
        }
        if (params?.equalsTo && value != params.equalsTo) {
            this.errorMsg = `[field] is not equal to required value`;
            return false;
        }
        if (
            params?.in?.length
        ) {
            if (params?.sensitiveCaseIn && !params.in.some((item) => item == value)) {
                this.errorMsg = `[field] ${t("must be one the following values (sensitive case)")} ${String(params.in)}`;
                return false;
            } else if (!params?.sensitiveCaseIn && !params.in.some((item) => item.toUpperCase() == value.toUpperCase())) {
                this.errorMsg = `[field] ${t("must be one the following values (insensitive case)")} ${String(params.in)}`;
                return false;
            }
        }


        return true;
    }
    errorMsg = "";
    msg(field = "Field", _, t: Translate) {
        if (!this.errorMsg) {
            return `${field} ${t("is not a valid title")}`;
        } else {
            return this.errorMsg.replaceAll("[field]", field);
        }
    }
}

export interface titleValidatorParameters {
    max?: number | false;
    min?: number;
    sensitiveCaseReserved?: boolean;
    sensitiveCaseIn?: boolean;
    eq?: number;

    equalsTo?: string;
    reserved?: Array<String>;
    in?: Array<String>;
}
export type titleSetterParameters = null;
export default [titleValidationRule];
