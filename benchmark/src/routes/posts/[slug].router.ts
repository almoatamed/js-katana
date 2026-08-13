import { createHandler } from "js-kt";

export default createHandler({
    method: "GET",
    serveVia: ["Http", "Socket"],
    handler: async (context, _body, _query, params: { slug: string }) => {
        return context.respond.json({
            slug: params.slug,
            msg: "post",
        });
    },
});
