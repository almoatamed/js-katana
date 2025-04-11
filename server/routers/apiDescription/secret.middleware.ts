import { encryptionConfig } from "../../config/encryption/index.js";
import { HandlerFunction } from "../../utils/express/index.js";
const multirules = (await import("../../utils/rules/multirules.js")).default;

const handlers: HandlerFunction[] = [
    async (request, response, next) => {
        try {
            await multirules([
                [
                    ["required", "title"],
                    request.body.secret,
                    "Secret",
                    {
                        title: {
                            equalsTo: await encryptionConfig.getDescriptionsSecret(),
                        },
                    },
                ],
            ]);
            next();
        } catch (error: any) {
            next(error);
        }
    },
];
export default handlers;
