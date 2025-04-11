;
import { ErrorRequestHandler } from "express";
import * as logUtil from "../log/index.js";
import rm from "../storage/rm.js";

const llogYellow = await logUtil.localLogDecorator("Request Error", "yellow", true, "Info");

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
export const errorHandler: ErrorRequestHandler = async (origialError, req, res, next) => {
    try {
        let error: any;
        if (origialError?.response?.status) {
            error = origialError?.response?.data;
        } else {
            error = origialError;
        }
        const msg: string = String(
            (typeof error == "string" ? error : null) ||
                error?.message ||
                error?.msg ||
                error?.error?.message ||
                error?.error?.msg ||
                error ||
                "Unknown",
        );

        process.env.NODE_ENV !== "test" && console.trace(msg);

        let statusCode: number;
        if (error?.statusCode) {
            statusCode = error.statusCode;
        } else {
            statusCode = 500;
        }
        rm.array(req);

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
        llogYellow.error(error, "Error", "Failed To Handle Error on Error Middleware", origialError);
    }
};
