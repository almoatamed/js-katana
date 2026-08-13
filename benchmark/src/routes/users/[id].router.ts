import { createHandler } from "js-kt";

export default createHandler({
    method: "GET",
    serveVia: ["Http", "Socket"],
    handler: async (context, _body, _query, params: { id: string }) => {
        return context.respond.json({
            id: params.id,
            msg: "user",
        });
    },
});
