import { Translate } from "../index.js";

const math = (await import("$/server/utils/common/index.js")).math;

class numberValidationRule {
    rule(value: any, params: numberValidatorParameters, _, t: Translate) {
        const validNumber = !Number.isNaN(Math.floor(Number(value)));
        if (!validNumber) {
            this.errorMsg = `[field] ${t("must be valid number")}`;
            return false;
        }

        if (!Number.isNaN(Number(params?.max))) {
            if (params.maxExclusive) {
                if (math.fixed(value) >= math.fixed(params.max)) {
                    this.errorMsg = `[field] ${t("must be less than")} ${math.fixed(params.max)}`;
                    return false;
                }
            } else {
                if (math.fixed(value) > math.fixed(params.max)) {
                    this.errorMsg = `[field] ${t("must be less than or equal to")} ${math.fixed(params.max)}`;
                    return false;
                }
            }
        }

        if (!Number.isNaN(Number(params?.min))) {
            if (params.minExclusive) {
                if (math.fixed(value) <= math.fixed(params.min)) {
                    this.errorMsg = `[field] ${t("must be greater than")} ${math.fixed(params.min)}`;
                    return false;
                }
            } else {
                if (math.fixed(value) < math.fixed(params.min)) {
                    this.errorMsg = `[field] ${t("must be greater than or equal to")} ${math.fixed(params.min)}`;
                    return false;
                }
            }

            if (!Number.isNaN(Number(params?.equals)) && math.fixed(value) != math.fixed(params.equals)) {
                this.errorMsg = `[field] ${t("must be ")} ${math.fixed(params.equals)}`;
                return false;
            }
        }

        if (!Number.isNaN(Number(params?.min)) && math.fixed(value) < math.fixed(params.min)) {
            this.errorMsg = `[field] ${t("must be greater then")} ${math.fixed(params.max)}`;
            return false;
        }

        return true;
    }
    set(value: any, params: numberSetterParameters) {
        if (params?.float) {
            return math.fixed(parseFloat(value));
        } else {
            return Math.floor(Number(value));
        }
    }
    errorMsg = "";
    msg(field = "Field", _, t: Translate) {
        if (!this.errorMsg) {
            return `${field} ${t("is not a valid number")}`;
        } else {
            return this.errorMsg.replaceAll("[field]", field);
        }
    }
}

export interface numberValidatorParameters {
    max?: number;
    min?: number;
    minExclusive?: boolean;
    maxExclusive?: boolean;
    equals?: number;
}
export interface numberSetterParameters {
    obj: Object;
    key: String;
    float: Boolean;
}
export default [numberValidationRule];
