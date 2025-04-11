import type { InternalGeneralOptions, Translate } from "../index.js";

export interface RuleBase {
    msg(field: string, options: InternalGeneralOptions, t: Translate): string; 
    set?(value: any, sourceObject: any): any;
    rule(
        value: any,
        params: any,
        options: InternalGeneralOptions,
        t: Translate
    ) : (boolean | undefined) | Promise<(boolean | undefined)>;
    recursive?: boolean; 
    statusCode?: number | null; 

}