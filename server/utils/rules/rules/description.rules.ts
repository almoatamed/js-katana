class descriptionValidationRule {
    errorMsg = "";
    max = 2000;
    msg(field = "Field") {
        if (!this.errorMsg) {
            return `${field} is not a valid description`;
        } else {
            return this.errorMsg.replaceAll("[field]", field);
        }
    }
    rule(value) {
        if (typeof value != "string") {
            this.errorMsg = "[field] must be a string";
            return false;
        }
        if (value.length > this.max) {
            this.errorMsg = `[field] cant be longer then ${this.max}`;
            return false;
        }
        return true;
    }
}

export type descriptionValidatorParameters = null;
export type descriptionSetterParameters = null;
export default [descriptionValidationRule];
