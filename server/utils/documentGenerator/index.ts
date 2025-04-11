import common from "$/server/utils/common/index.js";
import path from "path";
import { corpConfig } from "../../config/corp/index.js";
import { multithreadingConfig } from "../../config/multithreading/index.js";
import rootPaths from "../dynamicConfiguration/rootPaths.js";
import { appIdentityConfig } from "../../config/appIdentity/index.js";
const rs = common.ObjectManipulation.rs;

const render = multithreadingConfig.workerRenderEngine()
    ? (await import("$/server/utils/renderEngine/proxy/index.js")).default
    : (await import("$/server/utils/renderEngine/index.js")).default;

/**
 *
 * @param {string} title
 * @param {Array<DocumentPage>} pages
 * @returns {import('../renderEngine/index.js').SectionDescriptor}
 */
function pages(
    title: string,
    pages: Array<DocumentPage>,
    footerNote?: string,
): import("../renderEngine/index.js").SectionDescriptor {
    const returnedObject = {
        type: "page-div",
        style: {
            pageContent: {
                direction: "rtl",
                flex: "1",
            },
        },
        pages: pages,
    } as any;
    returnedObject.header = [
        {
            type: "div",
            style: {
                margin: "0px",
                width: "100%",
                fontSize: "12px",
                zIndex: "10000",
                direction: "rtl",
                display: "flex",
                justifyContent: "space-between",
            },
            content: [
                {
                    type: "div",
                    style: {
                        margin: "0px",
                        width: "100%",
                        fontSize: "8px",
                        zIndex: "10000",
                    },
                    content: [
                        {
                            type: "div",
                            style: {
                                display: "flex",
                                justifyContent: "space-between",
                                flexWrap: "nowrap",
                                width: "100%",
                                alignContent: "center",
                            },
                            content: [
                                {
                                    type: "img",
                                    src: appIdentityConfig.getLogo()
                                        ? path.join(rootPaths.srcPath, "assets/images", appIdentityConfig.getLogo()!)
                                        : appIdentityConfig.getLogoUrl(),
                                    style: {
                                        maxHeight: "0.5cm",
                                        display: "flex",
                                        justifyContent: "center",
                                        alignContent: "center",
                                    },
                                },
                                {
                                    type: "div",
                                    content: [
                                        {
                                            type: "span",
                                            text: title,
                                            style: {
                                                fontFamily: "arial",
                                                fontWeight: "600",
                                                fontSize: "14px",
                                                color: "#00000099",
                                            },
                                        },
                                    ],
                                },
                                {
                                    type: "div",
                                    content: [
                                        {
                                            type: "span",
                                            text: appIdentityConfig.getName(),
                                            style: {
                                                fontFamily: "arial",
                                                fontWeight: "700",
                                                color: "#FE3C50",
                                                fontSize: "14px",
                                            },
                                        },
                                    ],
                                },
                            ],
                        },
                        {
                            type: "hr",
                        },
                    ],
                },
            ],
        },
    ];
    returnedObject.footer = [
        {
            type: "div",
            content: [
                footerNote
                    ? {
                          type: "div",
                          style: {
                              direction: "rtl",
                          },
                          content: [
                              {
                                  type: "span",

                                  text: footerNote,
                              },
                          ],
                      }
                    : undefined,
                {
                    type: "header",
                    style: {
                        main: {
                            bottom: "-0.1cm",
                            margin: "0px",
                            flex: "0",
                            width: "100%",
                            fontSize: "8px",
                            zIndex: "10000",
                        },
                        container: {
                            display: "flex",
                            justifyContent: "space-between",
                            flexWrap: "nowrap",
                            // width: "100%",
                            alignContent: "center",
                            margin: "0cm",
                        },
                        left: {
                            display: "flex",
                            justifyContent: "center",
                            alignContent: "center",
                        },
                        center: {},
                        right: {},
                        hr: {
                            height: "1px",
                        },
                    },
                    left: [
                        {
                            type: "span",
                            text: corpConfig.getCorpName() ? "By " + corpConfig.getCorpName() : "",
                            style: {
                                display: "block",
                                color: "#006EE9",
                                fontWeight: "bold",
                            },
                        },
                        {
                            type: "img",
                            src: corpConfig.getCorpLogo()
                                ? path.join(rootPaths.appPath, "server/assets/images", corpConfig.getCorpLogo()!)
                                : corpConfig.getCorpLogoUrl(),
                            style: {
                                marginLeft: "4px",
                                marginTop: "-1px",
                                display: "block",
                                height: "15px",
                                textAlign: null, // place it after the pre text
                            },
                        },
                    ],
                    center: [],
                    right: [
                        {
                            type: "span",
                            classes: ["pageNumber"],
                            style: {},
                        },
                        {
                            type: "span",
                            classes: [],
                            text: "/",
                            style: {},
                        },
                        {
                            type: "span",
                            text: null,
                            classes: ["totalPages"],
                            style: {},
                        },
                    ],
                    hrBottom: false,
                    hrTop: true,
                },
            ].filter((e) => !!e),
        },
    ];

    return returnedObject;
}
export { pages };

export type TableData = any;

export type TableHeader<T> = { text: string; value: string | number | ((row: T, index: number) => any) };

type Table<T> =  {
    headers: TableHeader<T>[];
    data: T[];
    colouring?: (item: T) => string[];
}

function table<T>(table: Table<T>): import("$/server/utils/renderEngine/index.js").SectionDescriptor {
    function readCell(headerSelector, row, index: number) {
        let val;
        if (typeof headerSelector == "function") {
            val = headerSelector(row, index);
        } else {
            val = rs(headerSelector, row);
        }
        if (Number(val)) {
            val = Number(val);
            if (String(val).split(".")[1]?.length > 2) {
                return val.toFixed(2);
            } else {
                return val;
            }
        } else {
            return val;
        }
    }
    const headers = table.headers.map((header) => {
        return {
            text: header.text,
            value: header.text,
        };
    });

    const data = table.data.map((item, index) => {
        const returnedItem = {} as any;
        for (const header of table.headers) {
            returnedItem[header.text] = readCell(header.value, item, index);
        }
        if (table.colouring) {
            returnedItem.classes = table.colouring(item);
        }
        return returnedItem;
    });

    return {
        type: "table",
        headers: headers,
        data: data,
    };
}
export { table };

function empty_String(text) {
    if (text === null || text === undefined || String(text).trim() === "") {
        return "//";
    } else {
        if (parseFloat(text) == text) {
            text = common.math.fixed(text);
        } else if (Math.floor(text) == text) {
            text = Math.floor(text);
        }
        return String(text);
    }
}

/**
 *
 * @param {{text:string, value:string|number|null|undefined}} item
 * @returns {import('../renderEngine/index.js').SectionDescriptor}
 */
function field(item: {
    text: string;
    value: string | number | null | undefined;
}): import("../renderEngine/index.js").SectionDescriptor {
    return {
        type: "tr",
        style: {
            margin: "0px",
            pageBreakBefore: "avoid !important",
            fontFamily: "arial",
            fontSize: "12px",
            // background:"blue",
        },
        content: [
            {
                type: "div",
                style: {
                    margin: "0px",
                    marginBottom: "3px",
                    padding: "0px",
                    // background: "red"
                },
                content: [
                    {
                        type: "span",
                        text: item.text,
                        style: {
                            pageBreakBefore: "avoid",
                            margin: "0px !important",
                            padding: "4px !important",
                            fontSize: "12px",
                            borderTopRightRadius: "7px",
                            borderTopLeftRadius: "7px",
                            backgroundColor: "#eeeeee",
                            color: "#00000088",
                        },
                    },
                ],
            },
            {
                type: "div",
                style: {
                    margin: "0cm",
                    padding: "0.12cm",
                    pageBreakBefore: "avoid",
                    border: "solid #eeeeee 0.06cm",
                    borderRadius: "2px",
                },
                content: [
                    {
                        type: "span",
                        text: empty_String(item.value),
                        style: {
                            color: "#000000aa",
                        },
                    },
                ],
            },
        ],
    };
}
export { field };

/**
 *
 * @param {Array<{text:string, value:string|number|null|undefined}>} data
 * @returns {import('../renderEngine/index.js').SectionDescriptor}
 */
function fields(
    data: Array<{ text: string; value: string | number | null | undefined }>,
): import("../renderEngine/index.js").SectionDescriptor {
    function getData(el) {
        return `${el.value}`;
    }
    function calculateColumns(el, nextItem, accumulative) {
        const text = getData(el);
        if (text.length > 35 || (!(accumulative.index % 2) && (!nextItem || String(nextItem?.value)?.length > 35))) {
            accumulative.index += 2;
            return "1 / 3";
        } else {
            accumulative.index += 1;
            return null;
        }
    }
    const accumulative = { index: 0 };
    return {
        type: "div",
        style: {
            display: "grid",
            width: "100%",
            gridTemplateColumns: "auto auto",
            gap: "0.4cm",
        },
        content: [
            ...data.map((el, index) => {
                return {
                    type: "div",
                    style: {
                        gridColumn: calculateColumns(el, data[index + 1], accumulative),
                    },
                    content: [field(el)],
                };
            }),
        ],
    };
}
export { fields };
/**
 *
 * @param {string} text
 * @returns {import('../renderEngine/index.js').SectionDescriptor}
 */
function subtitle(text: string): import("../renderEngine/index.js").SectionDescriptor {
    return {
        type: "div",
        style: {
            pageBreakInside: "avoid",
            pageBreakAfter: "avoid",
            margin: "0.3cm 0cm",
            fontSize: "16px",
            width: "100%",
            fontWeight: "700",
            fontFamily: "arial",
            // backgroundColor:"#eeeeee",
        },
        content: [
            {
                type: "span",
                text: text,
                style: {
                    // backgroundColor: "white",
                    padding: "0.2cm",
                    // borderRadius:"0.4cm"
                    borderBottom: "solid #FE3C5077 0.1cm",
                },
            },
            // {
            //     type: "div",
            //     style: {
            //         marginTop: "0.29cm",
            //         width: "100%",
            //         backgroundColor: "#FE3C5077",
            //         height: "4px",
            //     },
            //     content: [],
            // },
        ],
    };
}
export { subtitle };
/**
 *
 * @param {string} text
 * @returns {import('../renderEngine/index.js').SectionDescriptor}
 */
function title(text: string): import("../renderEngine/index.js").SectionDescriptor {
    return {
        type: "div",
        style: {
            pageBreakInside: "avoid",
            pageBreakAfter: "avoid",
            margin: "0.3cm 0cm",
            fontSize: "24px",
            width: "100%",
            fontWeight: "700",
            fontFamily: "arial",
            // backgroundColor:"#eeeeee",
        },
        content: [
            {
                type: "span",
                text: text,
                style: {
                    // backgroundColor: "white",
                    padding: "0.2cm",
                    // borderRadius:"0.4cm"
                    borderBottom: "solid #FE3C5077 0.2cm",
                },
            },
            {
                type: "div",
                style: {
                    marginTop: "0.29cm",
                    width: "100%",
                    backgroundColor: "#FE3C5077",
                    height: "4px",
                },
                content: [],
            },
        ],
    };
}
export { title };
/**
 *
 * @param {string} text
 * @returns {DocumentPage}
 */
function coverPage(text: string): DocumentPage {
    return {
        content: [
            {
                type: "h1",
                text: text,
                style: {
                    display: "flex",
                },
            },
        ],
        style: {
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            width: "100%",
        },
    };
}
export { coverPage };
/**
 *
 * @param {string} text
 * @returns {import('../renderEngine/index.js').SectionDescriptor}
 */
function paragraph(text: string): import("../renderEngine/index.js").SectionDescriptor {
    return {
        type: "p",
        style: {},
        text: text,
    };
}
export { paragraph };

interface DocumentPage {
    content: Array<import("../renderEngine/index.js").SectionDescriptor>;
    style?: Record<string, string | Record<string, string>>;
}

/**
 * @param {import('../renderEngine/index.js').DirectoryPath} dir placement under public
 * @param {string} title document title
 * @param {Array<DocumentPage>} documentPages
 */
async function generateDocument(
    dir: import("../renderEngine/index.js").DirectoryPath,
    title: string,
    documentPages: Array<DocumentPage>,
    footerNote?: string,
) {
    console.log(footerNote);
    const Document = await render({
        content: [pages(title, documentPages, footerNote)],
        data: {},
        save: {
            skeleton: false,
            renderedTemplate: true,
            dir: dir,
            data: false,
        },
        style: {
            loadImages: true,
            loadCss: true,
            paper: "A4",
            wrap: true,
        },
        template: {
            header: {
                section: "div",
                style: {
                    margin: "0px 0.4cm",
                    width: "100%",
                    fontSize: "12px",
                    zIndex: "10000",
                    direction: "rtl",
                    display: "flex",
                    justifyContent: "space-between",
                },
                content: [
                    {
                        type: "div",
                        style: {
                            margin: "0px 0.4cm",
                            width: "100%",
                            fontSize: "8px",
                            zIndex: "10000",
                        },
                        content: [
                            {
                                type: "div",
                                style: {
                                    display: "flex",
                                    justifyContent: "space-between",
                                    flexWrap: "nowrap",
                                    width: "100%",
                                    alignContent: "center",
                                },
                                content: [
                                    {
                                        type: "img",
                                        src: appIdentityConfig.getLogo()
                                            ? path.join(rootPaths.srcPath, "assets/images", appIdentityConfig.getLogo()!)
                                            : appIdentityConfig.getLogoUrl(),
                                        style: {
                                            maxHeight: "0.5cm",
                                            display: "flex",
                                            justifyContent: "center",
                                            alignContent: "center",
                                        },
                                    },
                                    {
                                        type: "div",
                                        content: [
                                            {
                                                type: "span",
                                                text: title,
                                                style: {
                                                    fontFamily: "arial",
                                                    fontWeight: "600",
                                                    fontSize: "14px",
                                                    color: "#00000099",
                                                },
                                            },
                                        ],
                                    },
                                    {
                                        type: "div",
                                        content: [
                                            {
                                                type: "span",
                                                text: "TripoliDevs",
                                                style: {
                                                    fontFamily: "arial",
                                                    fontWeight: "700",
                                                    color: "#FE3C50",
                                                    fontSize: "14px",
                                                },
                                            },
                                        ],
                                    },
                                ],
                            },
                            {
                                type: "hr",
                            },
                        ],
                    },
                ],
            },
            footer: {
                section: "header",
                style: {
                    main: {
                        margin: "0px 0.4cm",
                        width: "100%",
                        fontSize: "8px",
                        zIndex: "10000",
                        backgroundColor: "",
                    },
                    container: {
                        display: "flex",
                        justifyContent: "space-between",
                        flexWrap: "nowrap",
                        // width: "100%",
                        alignContent: "center",
                        margin: "0cm 0.3cm",
                    },
                    left: {
                        display: "flex",
                        justifyContent: "center",
                        alignContent: "center",
                    },
                    center: {},
                    right: {},
                    hr: {
                        height: "1px",
                    },
                },
                left: [
                    {
                        type: "span",
                        text: corpConfig.getCorpName() ? "By " + corpConfig.getCorpName() : "",
                        style: {
                            display: "block",
                            color: "#006EE9",
                            fontWeight: "bold",
                        },
                    },
                    {
                        type: "img",
                        src: corpConfig.getCorpLogo()
                            ? path.join(rootPaths.appPath, "server/assets/images", corpConfig.getCorpLogo()!)
                            : corpConfig.getCorpLogoUrl(),
                        style: {
                            marginLeft: "4px",
                            marginTop: "-1px",
                            display: "block",
                            height: "15px",
                            textAlign: null,
                        },
                    },
                ],
                center: [],
                right: [
                    {
                        type: "span",
                        classes: ["pageNumber"],
                        style: {},
                    },
                    {
                        type: "span",
                        classes: [],
                        text: "/",
                        style: {},
                    },
                    {
                        type: "span",
                        text: null,
                        classes: ["totalPages"],
                        style: {},
                    },
                ],
                hrBottom: false,
                hrTop: true,
            },
            name: "main",
            margin: {
                bottom: "1.8cm",
                left: "1cm",
                right: "1.2cm",
            },
        },
        dontRespond: true,
    });
    return Document;
}
export { generateDocument };
