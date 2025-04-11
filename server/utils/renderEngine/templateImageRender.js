const axios = (await import("axios")).default;
const fs = (await import("fs")).default;
const path = (await import("path")).default;
const svgToDataUrl = (await import("svg-to-dataurl")).default;

const method = "get";
const responseType = "arraybuffer";

/**
 * render Hthl documents, by converting each occurance of image url to image data url
 * so that the data of the image is embedded within the html file
 *
 * @param {*} target path of the target file
 * @param {*} dist distination where to save file
 *
 */
export default async function (target, dist) {
    async function replaceAsync(str, regex, asyncFn) {
        const promises = [];
        str.replaceAll(regex, (match, ...args) => {
            const promise = asyncFn(match, ...args);
            promises.push(promise);
        });
        const data = await Promise.all(promises);
        return str.replaceAll(regex, () => {
            return data.shift();
        });
    }

    async function replacer(url) {
        try {
            let dataUrl;

            // if local url
            let bareUrl = url.slice(1, -1);
            if (bareUrl.match(/^\.\//i)) {
                const htmlFolder = path.dirname(target);
                url = path.join(htmlFolder, bareUrl);
                const res = fs.readFileSync(url);
                dataUrl = svgToDataUrl(res.toString());
            } else {
                const res = await axios({ url: url.slice(1, -1), method, responseType });
                dataUrl = `data:${res.headers["content-type"]};base64,${res.data.toString("base64")}`;
            }

            return `\"${dataUrl}\"`;
        } catch (error) {
            console.log("error on replacing image source ", url, "\n the error is", error);
            return url;
        }
    }

    const re = /(?<=<img[^\<\>]*src\s*?=\s*?)(\'|\")(?!data)(.*?)\1/gi;
    let html = fs.readFileSync(target, { encoding: "utf-8" });
    html = await replaceAsync(html, re, replacer);
    fs.writeFileSync(dist, html);
}
