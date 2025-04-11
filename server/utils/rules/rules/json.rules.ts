import { localLogDecorator } from "$/server/utils/log/index.js";
import type { MultirulesFunction } from "../multirules.js";
import type { RuleBase } from "./base.js";

const log = await localLogDecorator("json rule", "yellow");

log("starting");
class jsonValidationRule implements RuleBase {
    recursive = true;
    multirule: MultirulesFunction;
    constructor(multirule: MultirulesFunction) {
        this.multirule = multirule;
    }
    async rule(value, params) {
        const multirules = this.multirule;
        // make sure that the value is
        // either string or a object
        if (typeof value != "string" && typeof value != "object") {
            this.errorMsg = `[field] must be either an JSON Object or a valid stringified JSON`;
            return false;
        }

        // if the value is string, then parse it
        if (typeof value == "string") {
            try {
                value = JSON.parse(value);
            } catch (error: any) {
                this.errorMsg = "[field] is not a valid JSON string";
                return false;
            }
        }

        // if params.type then, we check if it is an object or value
        if (params?.type) {
            if (params.type === "array" && !Array.isArray(value)) {
                this.errorMsg = `[field] must be an array. given value of type ${typeof value}`;
                return false;
            } else if (params.type == "object" && Array.isArray(value)) {
                this.errorMsg = `[field] must be of type Object not Array`;
                return false;
            } else if (typeof value != params.type) {
                this.errorMsg = `[field] must be of type ${params.type}. given value of type ${typeof value}`;
                return false;
            }
        }

        if (params?.multirules) {
            for (const rule of params.multirules) {
                rule[1] = value[rule[1]];
            }
            await multirules(params.multirules);
        }

        return true;
    }
    set(value: any, params: jsonSetterParameters) {
        if (params?.type == "string") {
            if (typeof value == "string") {
                return value;
            } else {
                return JSON.stringify(value);
            }
        } else if (params?.type == "object") {
            if (typeof value == "string") {
                return JSON.parse(value);
            } else {
                return value;
            }
        } else {
            let returnBase64;
            if (typeof value == "string") {
                returnBase64 = value;
            } else {
                returnBase64 = JSON.stringify(value);
            }
            return Buffer.from(returnBase64).toString("base64");
        }
    }
    errorMsg = "";
    msg(field = "Field") {
        if (!this.errorMsg) {
            return `${field} is not a valid JSON`;
        } else {
            return this.errorMsg.replaceAll("[field]", field);
        }
    }
}

export interface jsonSetterParameters {
    type: "base64" | "string" | "object";
    obj: any;
    key: String;
}
export default [jsonValidationRule];
