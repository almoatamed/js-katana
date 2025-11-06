import { ErrorRequestHandler } from "express";
import { createLogger } from "kt-logger";

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
export const errorHandler: ErrorRequestHandler = async (originalError, req, res, _next) => {
    try {
        let error: any;
        if (originalError?.response?.status) {
            error = originalError?.response?.data;
        } else {
            error = originalError;
        }
        const msg: string = String(
            (typeof error == "string" ? error : null) ||
                error?.message ||
                error?.msg ||
                error?.error?.message ||
                error?.error?.msg ||
                error ||
                "Unknown"
        );

        let statusCode: number;
        if (typeof error?.statusCode == "number") {
            statusCode = error.statusCode;
        } else {
            statusCode = 500;
        }

        log(`Request: ${res.locals.logId}`, `statusCode: ${statusCode}`, msg);

        if (!res.headersSent) {
            const errorJson = {
                error: {
                    msg: msg,
                },
                statusCode,
            };

            res.status(statusCode).json(errorJson);
        }
    } catch (error: any) {
        log.error(error, "Error", "Failed To Handle Error on Error Middleware", originalError);
    }
};
