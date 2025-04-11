const readEndpoint = await import("$/server/utils/routersHelpers/buildEndpoints/index.js");
const endpoints = (await import("../../utils/dynamicConfiguration/endpoints.js")).endpoints;
import express from "express"
async function run(app: ReturnType<typeof express>) {
    readEndpoint.routesLister(app._router);
    endpoints.set(null, "endpoints", readEndpoint.default);
}
export { run };
