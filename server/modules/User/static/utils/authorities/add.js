const authorities = (await import("./index.js")).default;

/**
 *
 * @param {import("./index.js").AuthorityDefinition} authority
 */
async function add(authority) {
    authorities.add(authority);
}

const run = () => authorities.run();
export { add, run };
