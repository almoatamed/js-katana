export type JSONResult<T> = T;
export type FileResult = Promise<{
    path: string;
}>;
export type Text = string;
export type Html = Text;

export type HandlerContext = {
    respond: {
        json: <D>(data: D) => JSONResult<D>;
        file: (fullPath: string) => FileResult;
        text: (text: string) => Text;
        html: (html: string) => Html;
    };
    locale: Record<string, any>;
    query: Record<string, any>;
    params: Record<string, any>;
    headers: Record<string, any>;
    setStatus: (statusCode: number) => HandlerContext;
    body: Record<string, any>;
};

export type Handler = (context: HandlerContext) => unknown;

export type Middleware = Handler;

export type Route = {
    externalMiddlewares: Middleware[];
    middleWares: Middleware[];
    serveVia: ("Http" | "Socket")[];
    __symbol: symbol;
    method: "GET" | "POST" | "PUT" | "DELETE" | "ALL" | "PATCH";
    handler: Handler;
};

export const routerSymbol = Symbol("Router symbol");

export const aliasSymbol = Symbol("Router Alias symbol");

export type RouterAlias = {
    __symbol: symbol;
    path: string;
    includeOriginalMIddlewares: boolean;
};
export const CreateAlias = (props: Omit<RouterAlias, "symbol">) => {
    return {
        ...props,
        __symbol: aliasSymbol,
    } as RouterAlias;
};

export const CreateHandler = (
    props: Omit<Omit<Omit<Route, "externalMiddlewares">, "__symbol">, "serveVia"> & {
        serveVia?: Route["serveVia"];
    }
) => {
    return {
        ...props,
        externalMiddlewares: [],
        serveVia: props.serveVia || ["Http", "Socket"],
        __symbol: routerSymbol,
    } as Route;
};

export const requestErrorSymbol = Symbol("Request Error");

export type RequestError = {
    __symbol: symbol;
    statusCode: number;
    errors: {
        error: string;
        errors?: string[] | undefined;
    }[];
};
export const throwRequestError = (
    statusCode: number,
    errors: {
        error: string;
        data?: any;
        errors?: string[];
    }[]
) => {
    const error = {
        statusCode,
        __symbol: requestErrorSymbol,
        errors,
    };
    throw error;
};
export const createRequestError = (
    statusCode: number,
    errors: {
        error: string;
        data?: any;
        errors?: string[];
    }[]
) => {
    const error = {
        statusCode,
        __symbol: requestErrorSymbol,
        errors,
    };
    return error;
};

export const extractRequestError = (error: any) => {
    if (error?.__symbol == requestErrorSymbol) {
        return error as RequestError;
    }
    return null;
};
