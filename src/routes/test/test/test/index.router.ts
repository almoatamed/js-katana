import { createHandler } from "../../../../../server/utils/router";
import { defineChannelHandler, defineEmittedEvent, Respond } from "../../../../../server/utils/channelsBuilder/index";

defineEmittedEvent<{
    greeting: string;
}, {
    reply: string;
    yourMom: string; 
}>("test/helloWorld${number}")


defineEmittedEvent<
    {
        greeting: string;
    },
    {
        reply: string;
    }
>("test/helloWorld2");

type Comment = {
    msg: string;
    person: Person;
    replies: {
        msg: string;
        timestamp: string;
        userId: string;
    }[];
};
type Post = {
    title: string;
    content: string;
    comments: Comment[];
};

type Person = {
    name: string;
    posts?: Post[];
    email: string;
    status: "active" | "inactive";
};

export const handler = defineChannelHandler((_socket) => {
    return {
        handler: async (
            body: {
                name: string;
                age: number;
            },
            respond: Respond<{ msg: string }> | undefined
        ) => {
            console.log("body", body);
            const p: Person = {
                email: "",
                name: (body as { name: string; age: number }).name,
                status: "active",
            };

            respond?.({
                msg: "Person created successfully",
            });
        },
    };
});

export default createHandler({
    method: "GET",
    handler: async (
        context,
        body: {
            name: string;
            age: number;
        }, 
        query: {
            search: string;
        }
    ) => {
        console.log("body", body, query);
        const p: Person = {
            email: "",
            name: "",
            status: "active",
        };

        return context.respond.json(p);
    },
});
