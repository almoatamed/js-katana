import type { Socket } from "socket.io";

export type JSONResult<T> = T;
export type FileResult = Promise<{
    path: string;
}>;
export type Text = string;
export type Html = Text;

export type HandlerContext<B, Q, P, H, SourceStream extends NodeJS.ReadableStream> = {
    respond: {
        json: <D>(data: D) => JSONResult<D>;
        file: (fullPath: string) => FileResult;
        text: (text: string) => Text;
        html: (html: string) => Html;
    };
    method: "GET" | "POST" | "PUT" | "DELETE" | "ALL" | "PATCH";
    locals: Record<string, any>;
    query: Q;
    fullPath: string;
    params: P;
    headers: H;
    setStatus: (statusCode: number) => HandlerContext<B, Q, P, H, SourceStream>;
    body: B;
} & (
    | {
          servedVia: "http";
          sourceStream: SourceStream;
          setHeader: (key: string, value: string) => void;
      }
    | {
          servedVia: "socket";
          socket: Socket;
      }
);

export type Handler<T, B, Q, P, H, S extends NodeJS.ReadableStream> = (
    context: HandlerContext<B, Q, P, H, S>,
    body: B,
    query: Q,
    params: P,
    headers: H
) => T;

export type Middleware<T, B, Q, P, H, S extends NodeJS.ReadableStream> = Handler<T, B, Q, P, H, S>;

export const defineMiddleware = <T, B, Q, P, H, S extends NodeJS.ReadableStream>(
    middleware: Middleware<T, B, Q, P, H, S>
) => {
    return middleware;
};

export type Route<T, B, Q, P, H, S extends NodeJS.ReadableStream> = {
    externalMiddlewares: Middleware<any, B, Q, P, H, S>[];
    middleWares: Middleware<any, B, Q, P, H, S>[];
    serveVia: ("Http" | "Socket")[];
    __symbol: symbol;
    method: "GET" | "POST" | "PUT" | "DELETE" | "ALL" | "PATCH";
    handler: Handler<T, B, Q, P, H, S>;
};

export const routerSymbol = Symbol("Router symbol");

export const aliasSymbol = Symbol("Router Alias symbol");

export type RouterAlias = {
    __symbol: symbol;
    path: string;
    includeOriginalMIddlewares: boolean;
};
export const createAlias = (props: Omit<RouterAlias, "symbol">) => {
    return {
        ...props,
        __symbol: aliasSymbol,
    } as RouterAlias;
};

export const createHandler = <T, B, Q, P, H, S extends NodeJS.ReadableStream>(
    props: Omit<
        Omit<Omit<Omit<Route<T, B, Q, P, H, S>, "externalMiddlewares">, "__symbol">, "serveVia">,
        "middleWares"
    > & {
        serveVia?: Route<T, B, Q, P, H, S>["serveVia"];
        middleWares?: Middleware<any, B, Q, P, H, S>[];
    }
) => {
    return {
        ...props,
        middleWares: props.middleWares || [],
        externalMiddlewares: [],
        serveVia: props.serveVia || ["Http", "Socket"],
        __symbol: routerSymbol,
    } as Route<T, B, Q, P, H, S>;
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
