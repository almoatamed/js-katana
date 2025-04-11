import common from "$/server/utils/common/index.js";
import { multithreadingConfig } from "../../config/multithreading/index.js";

const rs = common.ObjectManipulation.rs;

const render = multithreadingConfig.workerRenderEngine()
    ? (await import("$/server/utils/renderEngine/proxy/index.js")).default
    : (await import("$/server/utils/renderEngine/index.js")).default;

type Section = import("$/server/utils/renderEngine/index.js").SectionDescriptor;

function pages(pages: Array<DocumentPage>): import("$/server/utils/renderEngine/index.js").SectionDescriptor {
    const returnedObject = {
        type: "page-div",
        style: {
            pageContent: {
                direction: "rtl",
                flex: "1",
            },
        },
        pages: pages,
    };

    return returnedObject;
}
export { pages };

export type TableData = any;
export type TableHeader<T> = { text: string; value: string | number | ((row: T, index: number) => any) };
type Table<T> = {
    headers: TableHeader<T>[];
    data: T[];
    colouring?: (item: T) => string[];
};

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

function field(item: {
    text: string;
    value: string | number | null | undefined;
}): import("$/server/utils/renderEngine/index.js").SectionDescriptor {
    return {
        type: "tr",
        style: {
            margin: "0px",
            pageBreakBefore: "avoid !important",
            fontFamily: "arial",
            fontSize: "12px",
        },
        content: [
            {
                type: "div",
                style: {
                    margin: "0px",
                    marginBottom: "3px",
                    padding: "0px",
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: "6px",
                },
                content: [
                    {
                        type: "span",
                        text: `${item.text}: `,
                    },
                    {
                        type: "span",
                        text: item.value,
                    },
                ],
            },
        ],
    };
}
export { field };

function fields(
    data: Array<{ text: string; value: string | number | null | undefined }>,
): import("$/server/utils/renderEngine/index.js").SectionDescriptor {
    return {
        type: "div",
        style: {
            width: "100%",
            gap: "0.4cm",
            display: "flex",
            flexDirection: "column",
        },
        content: [
            ...data.map((el, index) => {
                return {
                    type: "div",
                    content: [field(el)],
                };
            }),
        ],
    };
}
export { fields };

function documentTitle(text: string): import("$/server/utils/renderEngine/index.js").SectionDescriptor {
    return {
        type: "div",
        style: {
            width: "100%",
            fontSize: "36px",
            padding: "12px",
            fontFamily: "Reem Kufi",
            alignItems: "center",
            justifyContent: "center",
            display: "flex",
        },
        content: [
            {
                type: "span",
                text: text,
            },
        ],
    };
}
export { documentTitle };

function paragraph(text: string): import("$/server/utils/renderEngine/index.js").SectionDescriptor {
    return {
        type: "p",
        style: {},
        text: text,
    };
}
export { paragraph };
interface DocumentPage {
    content: Array<Section>;
    style?: Record<string, string | Record<string, string>>;
}

const header = (props: { start: Section; middle: Section; end: Section }): Section => {
    return {
        type: "div",
        style: {
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
        },
        content: [
            {
                type: "div",
                content: [props.start],
                style: {
                    flex: "1",
                },
            },
            {
                type: "div",
                content: [props.middle],
                style: {
                    flex: "1",
                },
            },
            {
                type: "div",
                content: [props.end],
                style: {
                    flex: "1",
                },
            },
        ],
    };
};
export { header };

async function generateDocument(
    dir: import("$/server/utils/renderEngine/index.js").DirectoryPath,
    documentPages: Array<DocumentPage>,
) {
    const Document = await render({
        content: [pages(documentPages)],
        data: {},
        save: {
            skeleton: false,
            renderedTemplate: true,
            dir: dir,
            data: false,
        },
        style: {
            loadImages: false,
            loadCss: false,
            paper: "A4",
            wrap: true,
        },
        template: {
            name: "simplified",
            margin: {
                bottom: "1.8cm",
                left: "0.2cm",
                right: "0.2cm",
            },
        },
        dontRespond: true,
    });
    return Document;
}

export { generateDocument };
