import { dbModels } from "$/server/utils/database/prisma.js";
import type { Translate } from "../index.js";
import type { RuleBase } from "./base.js";
const client = (await import("$/server/utils/database/prisma.js")).default;

class existsValidationRule implements RuleBase {
    errorMsg = "";
    item = null;
    client = null;
    statusCode = 404;
    msg(field = "Field", _, t: Translate) {
        if (!this.errorMsg) {
            return `${field} ${t("with given identifier is not found")}`;
        } else {
            return this.errorMsg.replaceAll("[field]", field);
        }
    }
    async rule(value: any, params: existsValidatorParameters, _, t: Translate) {
        const models = dbModels.capModelsArray;
        if (params.include) {
            for (const key of Object.keys(params.include)) {
                if (models.includes(key)) {
                    params.include = {
                        ...params.include,
                        ...params.include?.[key],
                        [key]: undefined,
                    };
                    delete params.include?.[key];
                }
            }
        }
        if (params.select) {
            for (const key of Object.keys(params.select)) {
                if (dbModels.capModelsArray.includes(key)) {
                    params.select = {
                        ...params.select,
                        ...params.select?.[key],
                        [key]: undefined,
                    };
                    delete params.select?.[key];
                }
            }
        }
        if (params.where) {
            for (const key of Object.keys(params.where)) {
                if (dbModels.capModelsArray.includes(key)) {
                    params.where = {
                        ...params.where,
                        ...params.where?.[key],
                        [key]: undefined,
                    };
                    delete params.where?.[key];
                }
            }
        }

        const tx = params?.tx || params?.tx || client;

        const item = await tx[params.model].findFirst({
            where: {
                deleted: false,
                ...(() => {
                    if (params.idKey) {
                        if (params.parseInt === false) {
                            return { [params.idKey]: value };
                        } else {
                            return { [params.idKey]: Math.floor(Number(value)) || value };
                        }
                    } else {
                        return {};
                    }
                })(),
                ...(params?.where || {}),
            },
            include: params.include || undefined,
            select: params.select || undefined,
            orderBy: params.orderBy || undefined,
            take: params.take || undefined,
            skip: params.skip || undefined,
        });
        if (!item) {
            return false;
        }
        this.item = item;
        return true;
    }
    set(value: any) {
        return this.item;
    }
}

export type Where = import("$/server/utils/JsDoc/assets/where.js").Where;
export type Include = import("$/server/utils/JsDoc/assets/include.js").Include;
export type Select = import("$/server/utils/JsDoc/assets/select.js").Select;

export interface existsValidatorParameters {
    model: import("$/server/utils/JsDoc/assets/models.js").Model;
    take?: number;
    skip?: number;
    parseInt: boolean;
    tx?: any;
    idKey?: string;
    where?: Where;
    include?: Include;
    select?: Select;
    orderBy?: Object | Array<Object>;
}

export type existsSetterParameters =
    | {
          set: (value: any, passedValue: any) => void;
      }
    | {
          obj: Object;
          key: string;
      };
export default [existsValidationRule];
