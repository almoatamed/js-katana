import { ErrorRequestHandler } from "express";
import { createLogger } from "kt-logger";
import { createRequestError, extractRequestError } from "../router/index.js";

const log = await createLogger({
    color: "yellow",
    logLevel: "Info",
    name: "Request Error",
    worker: true,
});

// error handling
/**
 * Expected structure of the Error is
 * {
 *  statusCode:<number>,
 *  error:{
 *     ... error content
 *  }
 * }
 */
export const expressErrorHandler: ErrorRequestHandler = async (originalError, req, res, _next) => {
    try {
        let error: any;
        if (originalError?.response?.status) {
            error = originalError?.response?.data;
        } else {
            error = originalError;
        }

        let extractedRequestError = extractRequestError(error);
        if (!extractedRequestError) {
            extractedRequestError = createRequestError(500, [
                {
                    error: "Unknown server error",
                    data: error,
                },
            ]);
        }

        const statusCode = extractedRequestError.statusCode || 500;

        if (!res.headersSent) {
            res.status(statusCode).json(extractedRequestError);
        }
    } catch (error: any) {
        log.error(error, "Error", "Failed To Handle Error on Error Middleware", originalError);
    }
};

// error handling
/**
 * Expected structure of the Error is
 * {
 *  statusCode:<number>,
 *  error:{
 *     ... error content
 *  }
 * }
 */
export const bunErrorHandler = (originalError: any) => {
    try {
        let error: any;
        if (originalError?.response?.status) {
            error = originalError?.response?.data;
        } else {
            error = originalError;
        }

        let extractedRequestError = extractRequestError(error);
        if (!extractedRequestError) {
            extractedRequestError = createRequestError(500, [
                {
                    error: "Unknown server error",
                    data: error,
                },
            ]);
        }

        const statusCode = extractedRequestError.statusCode || 500;
        return new Response(JSON.stringify(extractedRequestError), {
            status: statusCode,
        });
    } catch (error: any) {
        log.error(error, "Error", "Failed To Handle Error on Error Middleware", originalError);
        return new Response(
            JSON.stringify(
                createRequestError(500, [
                    {
                        error: "Unknown Error",
                        data: error,
                    },
                ])
            ),
            {
                status: 500,
            }
        );
    }
};
