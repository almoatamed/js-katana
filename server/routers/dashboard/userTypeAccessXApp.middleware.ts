import ObjectError from "$/server/utils/ObjectError/index.js";
import { HandlerFunction } from "$/server/utils/express/index.js";

const handler: HandlerFunction = async (req, _, next) => {
    try {
        if (req.query["x-app"]) {
            req.headers["x-app"] = req.query["x-app"] as string;
        }
        const appHeader = req.headers["x-app"] || req.query["x-app"];

        if (appHeader && appHeader === "main-app") {
            next();
        } else {
            throw new ObjectError({
                statusCode: 400,
                error: {
                    msg: "APP Header Not provided (x-app)",
                    appHeader: appHeader,
                },
            });
        }
    } catch (error: any) {
        next(error);
    }
};

export default [handler];
