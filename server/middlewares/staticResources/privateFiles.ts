import { HandlerFunction as Handler } from "../../utils/express/index.js";


// authentication middleware
const { auth } = (await import("$/server/middlewares/user.middleware.js")).default;
const { authorize } = (await import("$/server/middlewares/authorize.middleware.js")).default;

const handlers: Handler[] = [
    (request, response, next) => {
        try {
            if (!!request.query?.mat && typeof request.query?.mat == "string") {
                request.headers["authorization"] = request.query?.mat;
            }

            next();
        } catch (error: any) {
            next(error);
        }
    },
    auth,
    authorize({
        url: import.meta.url,

        allow: {
            or: ["viewPrivateFiles"],
        },
    }),
];

export default handlers;
