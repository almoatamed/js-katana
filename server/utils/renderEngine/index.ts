import { hostingConfig } from "../../config/hosting/index.js";
import { routerConfig } from "../../config/routing/index.js";

const fs = (await import("fs")).default;
const path = (await import("path")).default;
const url = (await import("url")).default;
const save = (await import("$/server/utils/storage/save.js")).default;
const axios = (await import("axios")).default;
const mimetypes = (await import("mime-types")).default;

const logUtil = await import("$/server/utils/log/index.js");

const log = await logUtil.localLogDecorator("RENDER-ENGINE", "yellow", true, "Info", true);

const appPath = path.resolve(path.join(path.dirname(url.fileURLToPath(import.meta.url)), "../../../."));

const globalTemporaryHtmlFile = url.fileURLToPath(new URL(`../../../temporaryHtml.html`, import.meta.url));

const paperMap: PapersSizes = {
    A4: {
        size: {
            width: 21,
            height: 29.7,
        },
    },
};

/**
 * cleans path for example if you give it "path/to/../unclean/./directory" returns "path/unclean/directory"
 *
 *
 */
function cleanAbsolute(path: string): string {
    const returnPath: string[] = [];
    const parts = path.split("/");
    for (const [i, part] of parts.entries()) {
        if (part == ".") {
            continue;
        } else {
            if (part == "..") {
                returnPath.pop();
            } else {
                returnPath.push(part);
            }
        }
    }
    return returnPath.join("/");
}

/**
 *
 * @param {DocumentSkeleton} skeleton
 * @returns {[Html, DirectoryPath, FilePath]} html content of template, directory path of template, index file path of template
 */
// template loader
function loadTemplate(skeleton: DocumentSkeleton): [Html, DirectoryPath, FilePath] {
    const templateError = Error("Not valid Template name, path is not valid");

    let html: string;
    let templateIndexPath: string;
    let templateDirectory: string;

    if (typeof skeleton.template != "object" && typeof skeleton.template != "string") {
        throw templateError;
    } else if (typeof skeleton.template == "object" && !skeleton.template.name) {
        throw templateError;
    } else if (typeof skeleton.template == "string") {
        if (!skeleton.template) {
            throw templateError;
        }
        skeleton.template = { name: skeleton.template };
    }

    if (skeleton.template.name?.match(/^\//)) {
        templateDirectory = skeleton.template.name;
    } else {
        templateDirectory = url.fileURLToPath(
            new url.URL(path.join("../../templates", skeleton.template.name || ""), import.meta.url),
        );
    }
    try {
        const templateStats = fs.statSync(templateDirectory);
        if (templateStats.isDirectory()) {
            templateIndexPath = path.join(templateDirectory, "index.html");
        } else {
            templateIndexPath = templateDirectory;
            templateDirectory = path.dirname(templateDirectory);
        }
        html = fs.readFileSync(templateIndexPath, "utf-8");

        return [html, templateDirectory, templateIndexPath];
    } catch (error: any) {
        throw templateError;
    }
}

/**
 *
 * @param {Array<RegExp>} regexArray
 * @param {"gi"|"g"|"i"} [flags]
 * @returns {RegExp}
 */
function regexArrayToRegex(regexArray: Array<RegExp>, flags?: "gi" | "g" | "i"): RegExp {
    return RegExp(regexArray.map((r) => r.toString().slice(1, -1)).join("|"), flags || "gi");
}

async function loadSections(html: Html, sections: Promise<Sections>) {
    const sectionRegexMatchers: Array<RegExp> = [
        // section $$
        // 1-> section name 2-> section contents
        /\$\$\[(.*?)\]\$\$((?:.|\n)*?)\!\!\[\1\]\!\!/,

        // 3-> section name 4-> section content
        // @ts-ignore
        /\<a-define-section\s*?\[(.*?)\]\s*?\>((?:\n|.)*?)\<\/a-define-section\s*?\[\3\]\s*?\>/,
    ];

    const re = regexArrayToRegex(sectionRegexMatchers);
    const res = await html.matchAll(re);
    for (const r of res) {
        if (r[1] && r[2]) {
            sections[r[1]] = r[2];
        } else if (r[3] && r[4]) {
            sections[r[3]] = r[4];
        }
    }
}

const regexList = [
    // if %%
    // 1-> if 2-> id 3-> condition 4->if-content
    // 5-> else-ifs 6-> else-content
    /(%%if)([1-9]{1,2})?\s*?\{((?:.|\n)*?)\}\s*?%%((?:.|\n)*?)((?:%%else-if\2\s*?\{(?:(?:.|\n)*?)\}\s*?%%(?:(?:.|\n)*?))*?)?(?:%%else\2\s*?%%((?:.|\n)*?))?%%endif\2\s*?%%/,

    // if <
    // 7-> if 8-> id 9-> condition 10->if-content
    // 11-> else-ifs 12-> else-content
    // @ts-ignore
    /(<a-if)([1-9]{1,2})?\s*?condition\s*?=\s*?(?:\'|\")((?:.|\n)*?)(?:\'|\")\s*?>((?:.|\n)*?)((?:<a-else-if\8\s*?condition\s*?=\s*?(?:\'|\")(?:(?:.|\n)*?)(?:\'|\")\s*?\/?\>(?:(?:.|\n)*?))*?)?(?:<a-else\8\s*?\/?\>((?:.|\n)*?))?<\/a-if\8\s*?>/,

    // for %%
    // 13->for 14->id 15->elName 16->indexName
    // 17->forEval 18->content
    // @ts-ignore
    /(%%for)([1-9]{1,2})?\s*?\[\s*?([a-zA-Z\_]+[a-zA-Z\_0-9]*?)(?:\s*?,\s*?([a-zA-Z\_]+[a-zA-Z\_0-9]*?))?\s*?\]\s*?\{((?:.|\n)*?)\}\s*?%%((?:.|\n)*?)%%endfor\14\s*?%%/,

    // for <
    // 19->for 20->id 21->elName 22->indexName
    // 23->forEval 24->content
    // @ts-ignore
    /(<a-for)([1-9]{1,2})?\s*?\[\s*?([a-zA-Z\_]+[a-zA-Z\_0-9]*?)(?:\s*?,\s*?([a-zA-Z\_]+[a-zA-Z\_0-9]*?))?\s*?\]\s*?array\s*?=\s*?(?:\'|\")((?:.|\n)*?)(?:\'|\")\s*?>((?:.|\n)*?)<\/a-for\20\s*?>/,

    // section %%
    // 25-> section 26->id 27->section object
    /(%%section)([1-9]{1,2})?\s*?\[(.*?)\]\s*?%%/,
    // section <
    // 28-> section 29->id 30->section object
    /(<a-section)([1-9]{1,2})?\s*?\[(.*?)\]\s*?\/?>/,

    // style %%
    // 31-> style, 32-> style selector 33-> spread or not
    /(%%style)\s*?(?:\[((?:.|\n)*?)(?:\s*?,\s*?(false|true))\s*?\])?\s*?%%/,

    // style <
    // 34-> style, 35-> style selector 36-> spread or not
    /(<a-style)\s*?(?:\[(.*?)(?:\s*?,\s*?(false|true))?\s*?\])?\s*?\/>/,

    // js
    // 37->js 38->content to eval
    /(\{\{)((?:.|\n)*?)\}\}/,

    // string
    // 39-> string
    /((?:.|\n)+?)/,
];

const allRegex = regexArrayToRegex(regexList, "gi");

// render engine
/**
 *
 * @param {SectionDescriptor} section
 * @param {Section} sectionTemplate
 * @param {Sections} sections
 * @returns {Promise<Html>}
 */
async function render(section: SectionDescriptor, sectionTemplate: Section, sections: Sections): Promise<Html> {
    const $ = section;

    const iterator = sectionTemplate.matchAll(allRegex);

    // else if
    //
    let renderString = "";

    for (const match of iterator) {
        // string
        // 39-> string
        if (match[39]) {
            renderString += match[39];
        }

        // js
        // 37->js 38->content to eval
        else if (match[37]) {
            try {
                const result = await eval(match[38]);
                if (typeof result == "string" || typeof result == "number") {
                    renderString += result;
                }
            } catch (err) {
                log.error(
                    "Rendering Engine->Section Renderer: Error on evaluating js statement",
                    match.slice(37, 39),
                    err,
                );
            }
        }

        // style <
        // 34-> style, 35-> style selector 36-> spread or not
        else if (match[34]) {
            let style = "";
            let styleSource = {} as any;
            try {
                if (match[35]) {
                    styleSource = eval(match[35]);
                } else {
                    styleSource = $.style;
                }
                if (typeof styleSource == "object") {
                    for (const [key, val] of Object.entries(styleSource)) {
                        if (val) {
                            style += `${key.replaceAll("_", "-").replace(/[a-z][A-Z]/g, (match) => {
                                return match[0] + "-" + match[1].toLowerCase();
                            })}: ${val}; `;
                        }
                    }
                } else if (typeof styleSource == "string") {
                    style = styleSource;
                }
                if (style) {
                    if (match[36] && eval(match[36])) {
                        renderString += ` style="${style}" `;
                    } else {
                        renderString += ` ${style} `;
                    }
                }
            } catch (err) {
                log.error("Rendering Engine->Section Renderer: Error on evaluating style", match.slice(34, 37), err);
            }
        }

        // style %%
        // 31-> style, 32-> style selector 33-> spread or not
        else if (match[31]) {
            let style = "";
            let styleSource = {} as any;
            try {
                if (match[32]) {
                    styleSource = eval(match[32]);
                } else {
                    styleSource = $.style;
                }
                if (!!styleSource && typeof styleSource == "object") {
                    for (const [key, val] of Object.entries(styleSource)) {
                        if (val) {
                            style += `${key.replaceAll("_", "-").replace(/[a-z][A-Z]/g, (match) => {
                                return match[0] + "-" + match[1].toLowerCase();
                            })}: ${val}; `;
                        }
                    }
                } else if (typeof styleSource == "string") {
                    style = styleSource;
                }
                if (style) {
                    if (match[33] && eval(match[33])) {
                        renderString += ` style="${style}" `;
                    } else {
                        renderString += ` ${style} `;
                    }
                }
            } catch (err) {
                log.error("Rendering Engine->Section Renderer: Error on evaluating style", match.slice(31, 34), err);
            }
        }

        // section <
        // 28-> section 29->id 30->section object
        else if (match[28]) {
            let subsection;
            try {
                subsection = await eval(match[30]);
                renderString += await process(subsection, sections);
            } catch (error: any) {
                log.error(
                    "Rendering Engine->Section Renderer: Invalid Section",
                    subsection,
                    Object.keys(sections),
                    error,
                );
            }
        }

        // section %%
        // 25-> section 26->id 27->section object
        else if (match[25]) {
            let subsection;
            try {
                subsection = await eval(match[27]);
                renderString += await process(subsection, sections);
            } catch (error: any) {
                log.error("Rendering Engine->Section Renderer: Invalid Section", subsection, error);
            }
        }

        // for <
        // 19->for 20->id 21->elName 22->indexName
        // 23->forEval 24->content
        else if (match[19]) {
            try {
                const elementName = match[21];
                const indexName = match[22];
                const array = await eval(match[23]);
                if (Array.isArray(array)) {
                    for (const [i, el] of array.entries()) {
                        const subsectionObject = {} as any;
                        if (indexName) {
                            subsectionObject[indexName] = i;
                        }
                        subsectionObject[elementName] = el;
                        subsectionObject.root = section;
                        const result = await render(subsectionObject, match[24], sections);
                        renderString += result;
                    }
                } else {
                    log.error(
                        "Rendering Engine->Section Renderer: for statement evaluation error (not array) \n",
                        match.slice(19, 25),
                    );
                }
            } catch (error: any) {
                log.error(
                    "Rendering Engine->Section Renderer: for statement evaluation error \n",
                    match.slice(19, 25),
                    error,
                );
            }
        }

        // for %%
        // 13->for 14->id 15->elName 16->indexName
        // 17->forEval 18->content
        else if (match[13]) {
            try {
                const elementName = match[15];
                const indexName = match[16];
                const array = await eval(match[17]);
                if (Array.isArray(array)) {
                    for (const [i, el] of array.entries()) {
                        const subsectionObject = {} as any;
                        if (indexName) {
                            subsectionObject[indexName] = i;
                        }
                        subsectionObject[elementName] = el;
                        subsectionObject.root = section;
                        const result = await render(subsectionObject, match[18], sections);
                        renderString += result;
                    }
                } else {
                    log.error(
                        "Rendering Engine->Section Renderer: for statement evaluation error (not array) \n",
                        match.slice(13, 19),
                    );
                }
            } catch (error: any) {
                log.error(
                    "Rendering Engine->Section Renderer: for statement evaluation error \n",
                    match.slice(13, 19),
                    error,
                );
            }
        }

        // if <
        // 7-> if 8-> id 9-> condition 10->if-content
        // 11-> else-ifs 12-> else-content
        else if (match[7]) {
            try {
                const conditionResult = await eval(match[9]);
                let conditionSatisfied = false;
                if (conditionResult) {
                    conditionSatisfied = true;
                    renderString += await render($, match[10], sections);
                }
                if (match[11] && !conditionSatisfied) {
                    // else if regex
                    // 1->condition 2->content
                    const elseIfsRegex = RegExp(
                        `<a-else-if${
                            match[8] || ""
                        }\s*?condition\s*?=\s*?(?:\'|\")((?:.|\n)*?)(?:\'|\")\s*?\/?\>((?:.|\n)*?)(?=\<a\-|$)`,
                        "gi",
                    );
                    const elseIfs = match[11].matchAll(elseIfsRegex);
                    for (const elseIf of elseIfs) {
                        if (await eval(elseIf[1])) {
                            renderString += await render($, elseIf[2], sections);
                            conditionSatisfied = true;
                            break;
                        }
                    }
                }
                if (match[12] && !conditionSatisfied) {
                    renderString += await render($, match[12], sections);
                }
            } catch (error: any) {
                log.error(
                    "Rendering Engine->Section Renderer: if statement evaluation error \n",
                    match.slice(7, 13),
                    $,
                    error,
                );
            }
        }

        // if %%
        // 1-> if 2-> id 3-> condition 4->if-content
        // 5-> else-ifs 6-> else-content
        else if (match[1]) {
            try {
                const conditionResult = await eval(match[3]);
                let conditionSatisfied = false;
                if (conditionResult) {
                    conditionSatisfied = true;
                    renderString += await render($, match[4], sections);
                }
                if (match[5] && !conditionSatisfied) {
                    // else if regex
                    // 1->condition 2->content
                    const elseIfsRegex = RegExp(
                        `%%else-if${match[2] || ""}\s*?\{((?:.|\n)*?)\}\s*?%%((?:.|\n)*?)(?=%%|$)`,
                        "gi",
                    );
                    const elseIfs = match[5].matchAll(elseIfsRegex);
                    for (const elseIf of elseIfs) {
                        if (await eval(elseIf[1])) {
                            conditionSatisfied = true;
                            renderString += await render($, elseIf[2], sections);
                            break;
                        }
                    }
                }
                if (match[6] && !conditionSatisfied) {
                    renderString += await render($, match[6], sections);
                }
            } catch (error: any) {
                log.error(
                    "Rendering Engine->Section Renderer: if statement evaluation error \n",
                    match.slice(1, 7),
                    error,
                );
            }
        }
    }
    return renderString;
}

/**
 *
 * @param {Content} content
 * @param {Sections} sections
 * @returns {Promise<Html>}
 */
async function process(content: Content, sections: Sections): Promise<Html> {
    let rendered: string[] = [];
    if (!Array.isArray(content)) {
        log.warning(
            "\n\n Rendering Engine->Skeleton Processor: invalid content of skeleton to process (not an array",
            content,
            ")",
        );
        return "";
    }
    for (const section of content) {
        if (Array.isArray(section)) {
            const subRendered = await process(section, sections);
            rendered = [...rendered, subRendered];
        } else if (typeof section == "object") {
            if (section.type && sections[section.type]) {
                const sectionTemplate = sections[section.type];
                const result = await render(section, sectionTemplate, sections);
                if (typeof result == "string" || typeof result == "number") {
                    rendered.push(result);
                }
            } else {
                log.warning(
                    "\n\nRendering Engine->Skeleton Processor: invalid section (not fount in sections, \nsection type:)",
                    section.type,
                    "\n",
                    section,
                );
            }
        }
    }
    return rendered.join("\n");
}

/**
 * async replacer
 * @param {string} str
 * @param {RegExp} regex
 * @param {async function} asyncFn
 * @returns {Promise<string>}
 */
async function replaceAsync(str: string, regex: RegExp, asyncFn): Promise<string> {
    const promises: Promise<any>[] = [];
    str.replaceAll(regex, (match, ...args) => {
        const promise = asyncFn(match, ...args);
        promises.push(promise);
        return "";
    });
    const data = await Promise.all(promises);
    return str.replaceAll(regex, () => {
        return data.shift();
    });
}

/**
 * style and image to tags and data urls loaders
 * @param {Html} finalHtml
 * @param {DirectoryPath} resourcesRootDirectory where the css files exists
 * @returns {Promise<Html>}
 */
async function loadStyles(finalHtml: Html, resourcesRootDirectory: DirectoryPath): Promise<Html> {
    async function loadStyleLinks(finalHtml) {
        const linkRegex =
            /(\<link(?:.|\n)*?href=\s?("|'))(.*?)(\2(?:.|\n)*?rel=\s?("|')stylesheet\5(?:.|\n)*?\>)|(\<link(?:.|\n)*?rel=\s?("|')stylesheet\7(?:.|\n)*?href=\s?("|'))(.*?)(\8(?:.|\n)*?\>)/g;
        finalHtml = await replaceAsync(finalHtml, linkRegex, async function () {
            const match = arguments;
            if (match[3] || match[9]) {
                if (match[9]) {
                    match[3] = match[9];
                }
                if (match[3].startsWith("http")) {
                    try {
                        const css = await axios.get(match[3]);
                        if (css.headers["content-type"]?.includes("text/css") && typeof css.data == "string") {
                            const styleTag = `
                                        <style type="text/css">
                                            ${css.data}
                                        </style>
                                    `;
                            return styleTag;
                        } else {
                            log.warning("Rendering Engine->Wrapper: Unrecognizable content-type", match, {
                                ...css,
                                data: undefined,
                            });
                            return match[0];
                        }
                    } catch (err) {
                        log.warning(
                            "Rendering Engine->Wrapper: Error on fetching CSS HTTP LINK while loading style",
                            match,
                            err,
                        );
                        return match[0];
                    }
                } else {
                    try {
                        let css = null as null | string;
                        try {
                            css = fs.readFileSync(match[3]).toString();
                        } catch (error: any) {
                            if (error?.errno == -2) {
                                css = fs
                                    .readFileSync(path.join(path.dirname(resourcesRootDirectory), match[3]))
                                    .toString();
                            } else {
                                throw error;
                            }
                        }

                        if (css) {
                            const styleTag = `
                                        <style type="text/css">
                                            ${css}
                                        </style>
                                    `;
                            return styleTag;
                        } else {
                            log.warning(
                                "Rendering Engine->Wrapper: Error on fetching CSS FILE LINK, CSS did not load",
                                css,
                                match,
                            );
                            return match[0];
                        }
                    } catch (error: any) {
                        log.warning(
                            "Rendering Engine->Wrapper: Error on fetching CSS FILE LINK while loading style",
                            match,
                            error,
                        );
                        return match[0];
                    }
                }
            } else {
                return match[0];
            }
        });
        return finalHtml;
    }
    finalHtml = await loadStyleLinks(finalHtml);
    return finalHtml;
}

/**
 *
 * @param {Html} finalHtml
 * @param {DirectoryPath} resourcesRootDirectory  where the images exists
 * @param {{loadImagesAsUrls:Boolean}} options
 * @returns {Promise<Html>}
 */
async function loadImages(
    finalHtml: Html,
    resourcesRootDirectory: DirectoryPath,
    options: { loadImagesAsUrls: boolean } = {
        loadImagesAsUrls: true,
    },
): Promise<Html> {
    const imageRegex = /(\<img(?:.|\n)*?src\s*?=\s*?(\"|\'))((?:.|\n)*?)(\2(?:.|\n)*?\/?\>)/g;
    // 1-> image start
    // 2-> "
    // 3-> href
    // 4-> image end
    finalHtml = await replaceAsync(finalHtml, imageRegex, async function () {
        const match = arguments;
        if (match[3]) {
            if (match[3].startsWith("http")) {
                try {
                    if (options?.loadImagesAsUrls) {
                        return match[0];
                    }
                    const result = await axios({
                        responseType: "arraybuffer",
                        method: "GET",
                        url: match[3],
                    });
                    const dataurl = `data:${result.headers["content-type"]};base64,${result.data.toString("base64")}`;
                    return `${match[1]}${dataurl}${match[4]}`;
                } catch (error: any) {
                    log.warning(
                        "Rendering Engine->Wrapper->image loader: error while loading HTTP IMAGE LINK",
                        match,
                        error,
                    );
                    return match[0];
                }
            } else {
                try {
                    let imageBuffer = null as Buffer | null;
                    let filePath;
                    try {
                        imageBuffer = fs.readFileSync(match[3]);
                        filePath = match[3];
                    } catch (error: any) {
                        if (error?.errno == -2) {
                            filePath = path.join(resourcesRootDirectory, match[3]);
                            imageBuffer = fs.readFileSync(filePath);
                        } else {
                            throw error;
                        }
                    }
                    if (!imageBuffer || !mimetypes.types[path.extname(match[3]).slice(1)]) {
                        throw { errno: -2, errorMessage: "no image found" };
                    }
                    if (options?.loadImagesAsUrls) {
                        const cleanPath = cleanAbsolute(filePath);
                        const publicLocals = routerConfig.getStaticDirs()?.map((dir) => dir.local);
                        for (const dir of publicLocals) {
                            if (cleanPath.includes(`/${dir}/`)) {
                                const reg = RegExp(`(?<=${dir}\/).*?$`);
                                const returnPath =
                                    `${match[1]}http://${hostingConfig.getServerName()}/server/${
                                        routerConfig.getStaticDirs().filter((el) => el.local == dir)[0].remote
                                    }/` +
                                    cleanPath.match(reg)?.[0] +
                                    match[4];
                                return returnPath;
                            }
                        }
                    }

                    const dataurl = `data:${
                        mimetypes.types[path.extname(match[3]).slice(1)]
                    };base64,${imageBuffer.toString("base64")}`;
                    return `${match[1]}${dataurl}${match[4]}`;
                } catch (error: any) {
                    log.warning(
                        "Rendering Engine->Wrapper->image loader: error while loading FILE IMAGE LINK",
                        match,
                        error,
                    );
                    return match[0];
                }
            }
        } else {
            return match[0];
        }
    });
    return finalHtml;
}

/**
 *  place css from skeleton
 *
 * @param {Html} finalHtml
 * @param {RenderedDocumentSkeleton} skeleton
 * @returns {Promise<Html>}
 */
async function loadSkeletonStyle(finalHtml: Html, skeleton: RenderedDocumentSkeleton): Promise<Html> {
    if (typeof skeleton.style.css == "string") {
        finalHtml = await finalHtml.replace(
            "</head>",
            `
<style>
${skeleton.style.css}
</style>
</head>`,
        );
        return finalHtml;
    } else {
        return finalHtml;
    }
}

/**
 * place Css String into rendered Html
 * @param {Html} finalHtml
 * @param {Css} css
 * @returns
 */
async function loadWrapStyle(finalHtml: Html, css: Css) {
    finalHtml = await finalHtml.replace(
        "</head>",
        `
<style>
${css}
</style>
</head>`,
    );
    return finalHtml;
}

// place paper dimensions
/**
 *
 * @param {Html} finalHtml
 * @param {RenderedDocumentSkeleton} skeleton
 * @returns
 */
async function placePaperSize(finalHtml: Html, skeleton: RenderedDocumentSkeleton) {
    if (typeof skeleton.style.paper == "string") {
        finalHtml = await finalHtml.replace(
            "</head>",
            `
<style>

    @page {
        size: "${skeleton.style.paper.toUpperCase()}";
        margin-top: ${skeleton.template?.margin?.top};
        margin-bottom: ${skeleton.template?.margin?.bottom};
    }

    body, html {
    width: ${paperMap[skeleton.style.paper.toUpperCase()].size.width}cm;
    height: ${
        paperMap[skeleton.style.paper.toUpperCase()].size.height -
        (Number(skeleton.template?.margin?.top) || 0) -
        (Number(skeleton.template?.margin?.bottom) || 0)
    }cm;
    }

</style>
</head>`,
        );
        return finalHtml;
    } else {
        return finalHtml;
    }
}

// wrap rendered htmls
/**
 *
 * @param {Html} renderedHtml
 * @param {RenderedDocumentSkeleton} skeleton
 * @param {{temp:Boolean, css:Css}} options
 * @returns {Promise<Html>}
 */
async function wrap(
    renderedHtml: Html,
    skeleton: RenderedDocumentSkeleton,
    options: { temp: boolean; css: Css } = {
        temp: false,
        css: "",
    },
): Promise<Html> {
    let finalHtml = skeleton.template.html;
    if (!finalHtml) {
        return "";
    }
    // place body
    finalHtml = finalHtml?.replace(/(\<body(?:.|\n)*?\>)(?:.|\n)*?(\<\/body\s*?\>)/, `$1\n${renderedHtml}\n$2`);

    if (skeleton.style.loadCss && !options.temp) {
        finalHtml = await loadStyles(finalHtml, skeleton.template.templateDirectory || "");
    }
    if (skeleton.style.loadImages && !options.temp) {
        finalHtml = await loadImages(finalHtml, skeleton.template.templateDirectory || "", {
            loadImagesAsUrls: !!skeleton.style.loadImagesAsUrls,
        });
    }
    if (options?.css) {
        finalHtml = await loadWrapStyle(finalHtml, options.css);
    }
    if (typeof skeleton.style.paper == "string" && paperMap[skeleton.style.paper.toUpperCase()]) {
        finalHtml = await placePaperSize(finalHtml, skeleton);
    }

    if (skeleton.style.css) {
        finalHtml = await loadSkeletonStyle(finalHtml, skeleton);
    }
    return finalHtml;
}

/**
 *
 * @param {RenderedDocumentSkeleton} skeleton
 */
async function saveFiles(skeleton: RenderedDocumentSkeleton) {
    console.log("Saving rendered skeleton", skeleton.save);
    if (skeleton.save && skeleton.save.dir) {
        /**
         * @type {Array<import("$/server/utils/storage/save.js").File>}
         */
        const files: Array<import("$/server/utils/storage/save.js").File> = [];
        if (skeleton.save.data && skeleton.data) {
            files.push({
                data: JSON.stringify(skeleton.data, null, 4),
                name: "data.json",
                mimetype: "application/json",
            });
        }
        if (skeleton.save.skeleton) {
            files.push({
                data: JSON.stringify(skeleton, null, 4),
                name: "skeleton.json",
                mimetype: "application/json",
            });
        }
        if (skeleton.save.renderedTemplate) {
            files.push({
                data: skeleton.template.wrappedFinalHtml || skeleton.template.finalTemplate || "",
                name: "renderedTemplate.html",
                mimetype: "text/html",
            });
        }
        files.length > 0 &&
            (skeleton.files = (
                await save({
                    files: files,
                    dir: skeleton.save.dir,
                    userId: "1",
                    recursive: true,
                    overwrite: true,
                } as any)
            ).map((file) => file.path));
    }
}

/**
 *
 * @param {DocumentSkeleton} skeleton
 * @returns {RenderedDocumentSkeleton}
 */
async function renderSkeleton(skeleton: DocumentSkeleton): Promise<RenderedDocumentSkeleton> {
    const Skeleton: RenderedDocumentSkeleton = skeleton as any;

    // template html and paths
    const [html, templateDirectory, templateIndexPath] = loadTemplate(Skeleton);
    const temporaryPath = globalTemporaryHtmlFile; //path.join(templateDirectory, `temporary${Date.now()}.html`);
    Skeleton.template.html = html;
    Skeleton.template.templateDirectory = templateDirectory;
    Skeleton.template.indexPath = templateIndexPath;
    Skeleton.template.temporaryPath = temporaryPath;
    console.log("template directory:", templateDirectory);

    // template sections
    const sections = {} as any;
    await loadSections(html, sections);
    console.log("available template sections: ", Object.keys(sections));
    Skeleton.sections = sections;

    // section processor
    Skeleton.template.finalTemplate = await process(Skeleton.content, sections);

    if (Skeleton.style.wrap) {
        Skeleton.template.wrappedFinalHtml = await wrap(Skeleton.template.finalTemplate, Skeleton, {
            temp: false,
            css: "",
        });
    }

    if (Skeleton.save) {
        await saveFiles(Skeleton);
    }

    return Skeleton;
}

const defaultMarginTop = "0.3cm";
const defaultMarginBottom = "0.3cm";

/**
 *
 * @param {DocumentSkeleton} skeleton
 * @returns {Promise<RenderedDocumentSkeleton>}
 */
async function renderDocumentFromSkeleton(
    skeleton: DocumentSkeleton,
    newPage = true,
): Promise<RenderedDocumentSkeleton> {
    try {
        let startTime = Date.now();

        const Skeleton: RenderedDocumentSkeleton = skeleton as any;

        if (!Skeleton.template.margin) {
            Skeleton.template.margin = {} as any;
        }

        if (!Skeleton.template?.margin?.top) {
            (Skeleton as any).template.margin.defaultTop = "0.3cm";
        }

        if (!Skeleton.template?.margin?.bottom) {
            (Skeleton as any).template.margin.defaultBottom = "0.3cm";
        }
        // template html and paths
        const [html, templateDirectory, templateIndexPath] = loadTemplate(Skeleton);
        Skeleton.template.html = html;
        Skeleton.template.templateDirectory = templateDirectory;
        Skeleton.template.indexPath = templateIndexPath;

        // template sections
        const sections = {} as any;
        await loadSections(html, sections);
        log("available template sections: ", Object.keys(sections));
        Skeleton.sections = sections;

        if (
            Skeleton.template.header &&
            typeof Skeleton.template.header == "object" &&
            Skeleton.sections[Skeleton.template.header?.section || "header"]
        ) {
            Skeleton.template.header.html = await render(
                Skeleton.template.header,
                Skeleton.sections[Skeleton.template.header?.section || "header"],
                Skeleton.sections,
            );
            Skeleton.template.header.html = await loadImages(
                Skeleton.template.header.html,
                Skeleton.template.templateDirectory,
                {
                    loadImagesAsUrls: !!skeleton.style.loadImagesAsUrls,
                },
            );
            Skeleton.template.header.heightInPx = Skeleton.template.header.heightInPx || 0;
            Skeleton.template.header.heightInCm =
                Skeleton.template.header.heightInCm ||
                Math.floor(Skeleton.template.header.heightInPx || 0) * (Skeleton.template.cmPerPx || 0);

            log("loaded header, header height", Skeleton.template.header.heightInCm);
            (Skeleton as any).template.margin.top =
                Skeleton.template.margin?.top ||
                `${(Skeleton.template.header.heightInCm + 0.6).toFixed(1)}cm` ||
                defaultMarginTop;
        }
        if (
            Skeleton.template.footer &&
            typeof Skeleton.template.footer == "object" &&
            Skeleton.sections[Skeleton.template.footer?.section || "footer"]
        ) {
            Skeleton.template.footer.html = await render(
                Skeleton.template.footer,
                Skeleton.sections[Skeleton.template.footer?.section || "footer"],
                Skeleton.sections,
            );
            Skeleton.template.footer.html = await loadImages(
                Skeleton.template.footer.html,
                Skeleton.template.templateDirectory,
                {
                    loadImagesAsUrls: !!skeleton.style.loadImagesAsUrls,
                },
            );

            Skeleton.template.footer.heightInPx = Skeleton.template.footer.heightInPx || 0;
            Skeleton.template.footer.heightInCm =
                Skeleton.template.footer.heightInCm ||
                Math.floor(Skeleton.template.footer.heightInPx) * (Skeleton.template.cmPerPx || 0);

            (Skeleton as any).template.margin.bottom =
                Skeleton.template.margin?.bottom ||
                `${(Skeleton.template.footer.heightInCm + 0.6).toFixed(1)}cm` ||
                defaultMarginBottom;
        }

        // section processor
        Skeleton.template.finalTemplate = await process(Skeleton.content, Skeleton.sections);

        if (Skeleton.style.wrap) {
            Skeleton.template.wrappedFinalHtml = await wrap(Skeleton.template.finalTemplate, Skeleton, {
                temp: false,
                css: "",
            });
        }
        if (Skeleton.save) {
            await saveFiles(Skeleton);
        }
        log("finish time", Date.now() - startTime);

        return Skeleton;
    } catch (error: any) {
        log.error("Document Render Error:", error);
        throw error;
    }
}

export default renderDocumentFromSkeleton;

export {
    globalTemporaryHtmlFile,
    loadImages,
    paperMap,
    process,
    render,
    renderDocumentFromSkeleton,
    renderSkeleton,
    replaceAsync,
    saveFiles,
    wrap,
};

export interface Paper {
    size: { width: number; height: number };
}
export type PaperType = "A4" | "A3" | "A1" | "Letter";
export type PapersSizes = {
    [key in PaperType]?: Paper;
};

export type Html = string;
export type FilePath = string;

export type DirectoryPath = string;
export type TemplateName = string;

export type Section = Html;

export type SectionName = string;

export type Sections = {
    [key: string]: Section;
};

export interface Margins {
    left?: string;
    right?: string;
    top?: string;
    bottom?: string;
}

export interface Header {
    section?: SectionName;
    heightInPx?: number;
    heightInCm?: number;
    content?: Content;
    type?: SectionName;
    style?: {
        [key: string]:
            | {
                  [key: string]: null | string;
              }
            | string
            | null;
    };
}
export interface Footer {
    section?: SectionName;
    heightInPx?: number;
    heightInCm?: number;
    content?: Content;
    type?: SectionName;
    style?: {
        [key: string]:
            | {
                  [key: string]: null | string;
              }
            | string
            | null;
    };
    [key: string]: any;
}
export interface RenderedHeader {
    section?: SectionName;
    html?: Html;
    heightInPx?: number;
    heightInCm?: number;
    content?: Content;
    type?: SectionName;
    style?: {
        [key: string]:
            | {
                  [key: string]: null | string;
              }
            | string
            | null;
    };
}
export interface RenderedFooter {
    section?: SectionName;
    html?: Html;
    heightInPx?: number;
    heightInCm?: number;
    content?: Content;
    type?: SectionName;
    style?: {
        [key: string]:
            | {
                  [key: string]: null | string;
              }
            | string
            | null;
    };
}

export interface RenderedSkeletonTemplate {
    name?: TemplateName | DirectoryPath;
    html?: Html;
    lastPageFooter?: SectionDescriptor;
    finalTemplate?: Html;
    wrappedFinalHtml?: Html;
    templateDirectory?: DirectoryPath;
    indexPath?: FilePath;
    temporaryPath?: FilePath;
    margin?: Margins;
    header?: RenderedHeader;
    footer?: RenderedFooter;
    cmPerPx?: number;
}
export interface SkeletonTemplate {
    lastPageFooter?: SectionDescriptor;
    name?: TemplateName | DirectoryPath;
    margin?: Margins;
    header?: Header;
    footer?: Footer;
    cmPerPx?: number;
}

export interface SectionDescriptor {
    content?: Content;
    type?: SectionName;
    style?: {
        [key: string]:
            | string
            | null
            | {
                  [key: string]: string | null;
              };
    };
    [key: string]: any;
}

export type Content = Array<SectionDescriptor>;

export type Css = string;

export interface SkeletonStyle {
    css?: Css;
    paper: PaperType;
    loadCss: boolean;
    wrap: boolean;
    loadImages: boolean;
    loadImagesAsUrls?: boolean;
}

export interface SaveSkeletonOptions {
    dir: DirectoryPath;
    data: boolean;
    skeleton: boolean;
    renderedTemplate: boolean;
}

export interface RenderedDocumentSkeleton {
    template: RenderedSkeletonTemplate;
    sections: Sections;
    data: any;
    files: Array<FilePath>;
    content: Content;
    style: SkeletonStyle;
    dontRespond: boolean;
    save: SaveSkeletonOptions;
}

export interface DocumentSkeleton {
    template: SkeletonTemplate;
    data: any;
    content: Content;
    style: SkeletonStyle;
    dontRespond: boolean;
    save: SaveSkeletonOptions;
}
