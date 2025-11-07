hi chat gpt, im building filesystem based router that supports channels (sockets and http) which can describe easily in one single file and the router builder will catch them all, 
it also switches between http and socket easily for http routes for better performance if configured and possible, 
it also extracts the descriptions of (types) of the handlers for http and channels definition and use them for client side type safety and auto complete 

you declare a http route handler as follow example 

```ts 
import { CreateHandler } from "../../server/utils/router";
type Comment = {
    msg: string;
    person: Person; 
    replies: {
        msg: string; 
        timestamp: string; 
        userId: string; 
    }[]; 
}
type Post = {
    title: string; 
    content: string; 
    comments: Comment[]; 
}

type Person = {
    name: string;
    posts?: Post[]; 
    email: string;
    status: "active" | "inactive";
};

export default CreateHandler({
    method: "POST",    
    handler: async (context, body: {
        name: string; 
        age: number; 
    }) => {
        const p: Person = {
            email: "",
            name: "",
            status: "active",
        };

        return context.respond.json(p);
    },
});

```
