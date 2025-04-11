import type { ModulesType } from "../../../modules/index.js";
import type { Translate } from "../index.js";
import type { RuleBase } from "./base.js";

class uniqueValidationRule implements RuleBase {
    errorMsg = "";
    item = null;
    statusCode = 409;
    msg(field = "Field", _, t: Translate) {
        if (!this.errorMsg) {
            return `${field} ${t("is not unique")}`;
        } else {
            return this.errorMsg.replaceAll("[field]", field);
        }
    }
    client = {} as ModulesType;
    async rule(value: any, params: _UniqueValidatorParameters) {
        const tx = params?.tx || this.client;

        const item = await tx[params.model].findFirst({
            where: {
                deleted: false,
                [params.uniqueKey]: (() => {
                    if (params.parseInt === false) {
                        return value;
                    } else {
                        return Math.floor(Number(value)) || value;
                    }
                })(),
                ...(params.where || {}),
            },
        });
        if (params?.exceptId && params.exceptId == item?.[params?.idKey as any]) {
            return true;
        }
        if (item) {
            return false;
        }
        return true;
    }
}

type Where = import("$/server/utils/JsDoc/assets/where.js").Where;

export interface _UniqueValidatorParameters {
    model: import("$/server/utils/JsDoc/assets/models.js").Model;
    uniqueKey: string;
    exceptId?: number | string;
    tx?: any;
    idKey?: string;
    parseInt?: boolean;
    where?: Where;
}
export type _UniqueSetterParameters = null;
export default [uniqueValidationRule];
