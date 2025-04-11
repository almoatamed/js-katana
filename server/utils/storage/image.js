const file = (await import("./file.js")).default;

const fileSize = 1024 * 1024;
const filesLimit = 1;

export const jpg = (fieldName, required, size = fileSize, limit = filesLimit) =>
    file(fieldName, required, size, ["image/jpeg", "image/jpg"], limit);

const jpgPng = (fieldName, required, size = fileSize, limit = filesLimit) =>
    file(fieldName, required, size, ["image/jpeg", "image/jpg", "image/png"], limit);

const png = (fieldName, required, size = fileSize, limit = filesLimit) =>
    file(fieldName, required, size, ["image/png"], limit);

export default {
    jpg,
    jpgPng,
    png,
};
