function generateValidator(update) {
    const validator = {
        set: function (Target, key, value) {
            if (typeof value == "object" && !Array.isArray(value)) {
                Target[key] = new Proxy({}, validator);
                for (const subKey in value) {
                    this.set(Target[key], subKey, value[subKey]);
                }
            } else if (typeof value == "object" && Array.isArray(value)) {
                Target[key] = value;
                Target[key].Push = Target[key].push;
                Target[key].push = function () {
                    this.Push(...arguments);
                    update();
                };
            } else {
                Target[key] = value;
            }
            update();
            return true;
        },
        deleteProperty(Target, key) {
            delete Target[key];
            update();
            return true;
        },
    };
    return validator;
}

function reloadProxy(proxy, source) {
    for (const key in source) {
        if (typeof source[key] == "object" && !Array.isArray(source[key])) {
            proxy[key] = {};
            reloadProxy(proxy[key], source[key]);
        } else {
            proxy[key] = source[key];
        }
    }
}

export { generateValidator };
export { reloadProxy };
