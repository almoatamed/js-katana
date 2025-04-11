export default {
    create: (await import("./create.js")).default,
    update: (await import("./update.js")).default,
    createMany: (await import("./createMany.js")).default,
    updateMany: (await import("./updateMany.js")).default,
};
