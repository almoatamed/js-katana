import { defineMiddleware } from "../../server/utils/router";
console.log("Log middleware loaded");
export default defineMiddleware((context) => {
    console.log(`Incoming request to ${context.method} ${context.fullPath}`);
});
