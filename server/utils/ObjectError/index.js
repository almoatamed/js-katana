import { t } from "../internationalization/index.js";

class ObjectError extends Error {
    /**
     * @type {{
     *   [key: string]: any;
     *   msg?: string;
     * }}
     */
    error = {};
    msg = "";

    /**
     * @type  {null | number}
     */
    statusCode = null;

    /**
     *
     * @param {{
     *       statusCode?: number;
     *       error?: {
     *           msg: string;
     *           [key: string]: any;
     *       };
     *       [key: string]: any;
     *   }} error
     * @param {import("../internationalization/index.js").LanguagesKey} [languageKey]
     */
    constructor(error, languageKey) {
        super();
        console.log(error);
        try {
            if (error?.error) {
                if (languageKey) {
                    if (error.error?.message) {
                        error.error.message = t(error.error?.message, languageKey);
                    }
                    if (error.error?.msg) {
                        error.error.msg = t(error.error?.message, languageKey);
                    }
                }

                this.error = error.error;
                this.statusCode = error.statusCode || error.statusCode || 500;
            } else {
                this.error = {
                    msg: error.message || error.msg || String(error),
                };
            }
        } catch (error) {
            // console.log(error)
        }
    }
    /**
     * @returns {String}
     */
    getMsg() {
        const err = this;
        return err.message || err.msg || err.error?.msg || err.error?.message;
    }
    toString() {
        return `${this.statusCode}, ${this.error}, ${this.msg}`;
    }
}
export default ObjectError;
