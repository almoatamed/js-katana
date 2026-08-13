import { createHandler } from "js-kt";

export default createHandler({
    method: "GET",
    serveVia: ["Http", "Socket"],
    handler: async (context) => {
        return context.respond.json({
            msg: "users",
        });
    },
});
