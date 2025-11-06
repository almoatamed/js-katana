import { Handler } from "express";
import moment from "moment";
import { createLogger } from "kt-logger";
const requestStartLogger = await createLogger({
    color: "red",
    logLevel: "Info",
    name: "Request Logger: Request",
    worker: true,
});
const requestEndLogger = await createLogger({
    color: "blue",
    logLevel: "Info",
    name: "Request Logger: Response",
    worker: true,
});

export const requestLogger: Handler = async (req, res, next) => {
    try {
        requestStartLogger();
        const logId = Math.floor(Math.random() * 1e10).toString(36);
        res.locals.logId = logId;
        const text = `
        request Id:${logId}
        method: ${req.method} 
        url: ${req.protocol}://${req.get("host")}${req.originalUrl} 
        Authentication: ${
            req.headers["authorization"]
                ? "Has Authorization Info in headers"
                : "Doesn't have Authorization Info in headers"
        }
        started at: ${moment()} 
        `;
        requestStartLogger(text);

        res.once("close", () => {
            try {
                const text = `
        request Id:${logId}
        method: ${req.method}
        url: ${req.protocol}://${req.get("host")}${req.originalUrl} 
        status code: ${res.statusCode}
        Ended at: ${moment()} 
        `;
                requestEndLogger(text);
            } catch (error: any) {
                requestEndLogger.error(error);
            }
        });

        next();
    } catch (error: any) {
        next(error);
    }
};
