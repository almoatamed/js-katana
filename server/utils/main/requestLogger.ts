import { Handler } from "express";
import moment from "moment";
import * as logUtil from "../log/index.js";

const llog = await logUtil.localLogDecorator("Request Logger", "red", true, "Info", true);
const llogBlue = await logUtil.localLogDecorator("Request Logger", "blue", true, "Info", true);

export const requestLogger: Handler = async (req, res, next) => {
    try {
        llog();

        const text = `
        method: ${req.method} 
        url: ${req.protocol}://${req.get("host")}${req.originalUrl} 
        Authentication: ${!!req.headers["authorization"] ? "Has JWT" : "Doesn't have JWT"}
        started at: ${moment()} 
        `;
        llog(text, "Info", "Http Request");

        res.once("close", () => {
            try {
                const text = `
        method: ${req.method}
        url: ${req.protocol}://${req.get("host")}${req.originalUrl} 
        status code: ${res.statusCode}
        Ended at: ${moment()} 
        `;
                llogBlue(text, "Info", "Http Response");
            } catch (error: any) {
                llog.error(error);
            }
        });

        next();
    } catch (error: any) {
        next(error);
    }
};
