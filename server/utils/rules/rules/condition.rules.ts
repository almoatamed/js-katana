import type { InternalGeneralOptions, Translate } from "../index.js";
import type { RuleBase } from "./base.js";

class conditionValidationRule implements RuleBase {
    translateConditionTo = "";
    condition = "";
    conditionsSymbols = ["<", ">", "<=", ">=", "==", "!=", "!in", "in"];
    conditions = {
        prisma: {
            "<": "lt",
            ">": "gt",
            "<=": "lte",
            ">=": "gte",
            "==": "equals",
            "!=": "not",
            "!in": "notIn",
            in: "in",
        },
        regular: {
            "<": "<",
            ">": ">",
            "<=": "<=",
            ">=": ">=",
            "==": "==",
            "!=": "!=",
            "!in": "!in",
            in: "in",
        },
    };

    errorMsg = "";
    msg(field = "Field", _, t: Translate) {
        if (!this.errorMsg) {
            return `${field} ${t("is not a valid condition symbol")}`;
        } else {
            return this.errorMsg.replaceAll("[field]", field);
        }
    }
    set(value: any) {
        return this.conditions[this.translateConditionTo][this.condition];
    }
    rule(value: any, params: conditionValidatorParameters,  GlobalParams: InternalGeneralOptions, t: Translate) {
        if (!params) {
            params = {};
        }
        if (!params?.translateConditionTo) {
            params.translateConditionTo = "regular";
        }
        const conditionsSet = this.conditions[params.translateConditionTo];
        const allConditionsSymbols = params.allowList || Object.keys(conditionsSet);
        if (!allConditionsSymbols.includes(value)) {
            this.errorMsg = `${t("condition provided for")} [field] ${t("is not valid")}, ${t("the condition must be one of")} ${allConditionsSymbols}`;
            return false;
        }
        this.condition = value;
        this.translateConditionTo = params.translateConditionTo;
        return true;
    }
}

export interface conditionValidatorParameters {
    translateConditionTo?: "prisma" | "regular";
    allowList?: Array<"<" | ">" | "<=" | ">=" | "==" | "!=" | "!in" | "in">;
}
export interface conditionSetterParameters {
    obj: Object;
    key: String;
}
export default [conditionValidationRule];
