// rules
import { localLogDecorator } from "$/server/utils/log/index.js";

const log = await localLogDecorator("multirule utility", "yellow", true);

log("starting");

const rules = (await import("./index.js")).default;
log("imported rules util");

export type RuleName =
    | "title"
    | "number"
    | "datestring"
    | "email"
    | "name"
    | "timestamp"
    | "address"
    | "array"
    | "boolean"
    | "condition"
    | "description"
    | "exists"
    | "unique"
    | "json"
    | "latitude"
    | "longitude"
    | "phone"
    | "url"
    | "required"
    | "password"
    | "timestring"
    | "timezone"
    | "username"
    | "weekdaystring"
    | "in"
    | "hexadecimal";

export type JSONRuleArray = [Array<RuleName>, String, String, RuleValidationParameters?, RuleSetterParameters?];

export interface JSONRule {
    rules: Array<RuleName>;
    value: String;
    fieldName: string;
    validationParameters: RuleValidationParameters;
    setterParameters: RuleSetterParameters;
}

export type JSONMultirules = Array<JSONRule | JSONRuleArray>;

export interface jsonValidatorParameters {
    multirules?: JSONMultirules;
    type: "string" | "object" | "array" | "number" | "boolean";
}

export interface RuleValidationParameters {
    title?: import("./rules/title.rules.js").titleValidatorParameters;
    hexadecimal?: import("./rules/hexadecimal.rules.js").hexadecimalValidatorParameters;
    in?: import("./rules/in.rules.js").inValidatorParameters;
    number?: import("./rules/number.rules.js").numberValidatorParameters;
    datestring?: import("./rules/datestring.rules.js").datestringValidatorParameters;
    email?: import("./rules/email.rules.js").emailValidatorParameters;
    timestamp?: import("./rules/timestamp.rules.js").timestampValidatorParameters;
    address?: import("./rules/address.rules.js").addressValidatorParameters;
    array?: import("./rules/array.rules.js").arrayValidatorParameters;
    boolean?: import("./rules/boolean.rules.js").booleanValidatorParameters;
    description?: import("./rules/description.rules.js").descriptionValidatorParameters;
    exists?: import("./rules/exists.rules.js").existsValidatorParameters;
    condition?: import("./rules/condition.rules.js").conditionValidatorParameters;
    unique?: import("./rules/unique.rules.js")._UniqueValidatorParameters;
    json?: jsonValidatorParameters;
    phone?: import("./rules/phone.rules.js").phoneValidatorParameters;
    latitude?: import("./rules/latitude.rules.js").latitudeValidatorParameters;
    longitude?: import("./rules/longitude.rules.js").longitudeValidatorParameters;
    url?: import("./rules/url.rules.js").urlValidatorParameters;
    required?: import("./rules/required.rules.js").requiredValidatorParameters;
    password?: import("./rules/password.rules.js").passwordValidatorParameters;
    timestring?: import("./rules/timestring.rules.js").timestringValidatorParameters;
    timezone?: import("./rules/timezone.rules.js").timezoneValidatorParameters;
    username?: import("./rules/username.rules.js").usernameValidatorParameters;
    weekdaystring?: import("./rules/weekdaystring.rules.js").weekdaystringValidatorParameters;
    name?: import("./rules/name.rules.js").nameValidatorParameters;
}

export interface RuleSetterParameters {
    title?: import("./rules/title.rules.js").titleSetterParameters;
    hexadecimal?: import("./rules/hexadecimal.rules.js").hexadecimalSetterParameters;
    in?: import("./rules/in.rules.js").inSetterParameters;
    number?: import("./rules/number.rules.js").numberSetterParameters;
    datestring?: import("./rules/datestring.rules.js").datestringSetterParameters;
    email?: import("./rules/email.rules.js").emailSetterParameters;
    timestamp?: import("./rules/timestamp.rules.js").timestampSetterParameters;
    address?: import("./rules/address.rules.js").addressSetterParameters;
    array?: import("./rules/array.rules.js").arraySetterParameters;
    boolean?: import("./rules/boolean.rules.js").booleanSetterParameters;
    description?: import("./rules/description.rules.js").descriptionSetterParameters;
    exists?: import("./rules/exists.rules.js").existsSetterParameters;
    condition?: import("./rules/condition.rules.js").conditionSetterParameters;
    unique?: import("./rules/unique.rules.js")._UniqueSetterParameters;
    json?: import("./rules/json.rules.js").jsonSetterParameters;
    phone?: import("./rules/phone.rules.js").phoneSetterParameters;
    latitude?: import("./rules/latitude.rules.js").latitudeSetterParameters;
    longitude?: import("./rules/longitude.rules.js").longitudeSetterParameters;
    url?: import("./rules/url.rules.js").urlSetterParameters;
    required?: import("./rules/required.rules.js").requiredSetterParameters;
    password?: import("./rules/password.rules.js").passwordSetterParameters;
    timestring?: import("./rules/timestring.rules.js").timestringSetterParameters;
    timezone?: import("./rules/timezone.rules.js").timezoneSetterParameters;
    username?: import("./rules/username.rules.js").usernameSetterParameters;
    weekdaystring?: import("./rules/weekdaystring.rules.js").weekdaystringSetterParameters;
    name?: import("./rules/name.rules.js").nameSetterParameters;
}

export interface Rule {
    rules: Array<RuleName>;
    value: any;
    fieldName: string;
    validationParameters: RuleValidationParameters;
    setterParameters: RuleSetterParameters;
}

export type RuleArray = [Array<RuleName>, any, String, RuleValidationParameters?, RuleSetterParameters?];

export type Multirules = Array<Rule | RuleArray>;

export interface GeneralOptions {
    lang?: import("$/server/utils/internationalization/index.js").LanguagesKey;
}

const multirule = async (
    validators: Multirules,
    options: undefined | GeneralOptions = undefined,
    _Recursive: boolean | null | undefined = false,
) => {
    for (const validator of validators) {
        await rules({
            Rules: validator[0],
            value: validator[1],
            fieldName: validator[2],
            args: validator[3],
            sourceObj: validator[4],
            recursive: _Recursive || false,
            multirule: multirule,
            generalOptions: options,
        });
    }
    return { valid: true, msg: "" };
};
export type MultirulesFunction = typeof multirule;

export default multirule;
