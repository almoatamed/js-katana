const fs = (await import("fs")).default;
const { join } = (await import("path")).default;
function isDirectory(path) {
    return fs.statSync(path).isDirectory();
}

/**
 *
 * @param {String} path
 * @param {String | null | undefined} extensionString
 * @param {Function | null | undefined} [extensionConditionCb]
 * @returns {Promise<Object>} promise contains the object of the built library
 *
 * @example
 * export default  (await build(path.join(srcPath, 'utils/myUtil'),'.myUtilModule.js'))
 *
 * @process
 * - build the extension check callback function if not identified
 * - create empty object
 * - read passed directory content
 * - for each element in the directory
 *   - if the element is a directory
 *     - we call the build function recursively with the path joined to the current element
 *       and null extension string and extension cb created
 *   - if not
 *     - we check if the file is an index file, if so we ignore it
 *     - we check if the file satisfies the callback, if so we import it
 */
async function build(path, extensionString, extensionConditionCb) {
    if (extensionConditionCb == undefined) {
        extensionConditionCb = (element) => {
            const index = element.indexOf(extensionString || ".js");
            if (index == -1) {
                return false;
            } else {
                return index;
            }
        };
    }
    const obj = {};
    const pathContent = fs.readdirSync(path);
    for (const element of pathContent) {
        if (element.includes("index")) {
            continue;
        }
        const joinedPath = join(path, element);
        if (isDirectory(joinedPath)) {
            obj[element] = await build(joinedPath, null, extensionConditionCb);
        } else {
            const index = extensionConditionCb(element);
            if (index) {
                obj[element.slice(0, index)] = (await import(joinedPath)).default;
            }
        }
    }
    return obj;
}

export default build;
