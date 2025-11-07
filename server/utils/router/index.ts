export type JSONResult<T> = T;
export type FileResult = Promise<{
    path: string;
}>;
export type Text = string;
export type Html = Text;

export type HandlerContext<B, Q, P, H> = {
    respond: {
        json: <D>(data: D) => JSONResult<D>;
        file: (fullPath: string) => FileResult;
        text: (text: string) => Text;
        html: (html: string) => Html;
    };
    locale: Record<string, any>;
    query: Q;
    params: P;
    headers: H;
    setStatus: (statusCode: number) => HandlerContext<B, Q, P, H>;
    body: B;
};

export type Handler<T, B, Q, P, H> = (
    context: HandlerContext<B, Q, P, H>,
    body: B,
    query: Q,
    params: P,
    headers: H
) => T;

export type Middleware<T, B, Q, P, H> = Handler<T, B, Q, P, H>;

export type Route<T, B, Q, P, H> = {
    externalMiddlewares: Middleware<any, B, Q, P, H>[];
    middleWares: Middleware<any, B, Q, P, H>[];
    serveVia: ("Http" | "Socket")[];
    __symbol: symbol;
    method: "GET" | "POST" | "PUT" | "DELETE" | "ALL" | "PATCH";
    handler: Handler<T, B, Q, P, H>;
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

export const CreateHandler = <T, B, Q, P, H>(
    props: Omit<
        Omit<Omit<Omit<Route<T, B, Q, P, H>, "externalMiddlewares">, "__symbol">, "serveVia">,
        "middleWares"
    > & {
        serveVia?: Route<T, B, Q, P, H>["serveVia"];
        middleWares?: Middleware<any, B, Q, P, H>[];
    }
) => {
    return {
        ...props,
        middleWares: props.middleWares || [],
        externalMiddlewares: [],
        serveVia: props.serveVia || ["Http", "Socket"],
        __symbol: routerSymbol,
    } as Route<T, B, Q, P, H>;
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
export const throwUnauthorizedError = (message?: string) => {
    throwRequestError(401, [
        {
            error: message || "Unauthorized",
        },
    ]);
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
