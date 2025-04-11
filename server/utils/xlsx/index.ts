import { recursiveSelect as rs } from "$/server/utils/common/index.js";

import ExcelJS from "exceljs";
import path from "path";

const theme = {
    success: "#4CAF50",
    black: "#000000",
    // primary: "#FE3C50",
    primary: "#006EE9",
    warning: "#FB8C00",
    error: "#FF5252",
    theme: "#064C86",

    // slighter
    slighterYellow: "#FFEADA",
    slighterGreen: "#DDF9E4",
    slighterBlue: "#E4F0FF",
    slighterPurple: "#F2EEF7",

    // slights
    slightGrey: "#EEF6F5",
    slightGreen: "#BAF2D0",
    slightYellow: "#FEE7A5",
    slightRed: "#FF787C",
    slightBlue: "#C6E7FF",

    // noice
    noiceGreen: "#02A443",
    noiceYellow: "#FAD160",
    noiceRed: "#FD2831",
    noiceBlue: "#51A6E3",

    // blue
    blue1: "#2F93F6",
    royal: "#064c86",
    primaryButtons: "#4372EA",

    // light blue
    info: "#00CAE3",

    // greys
    secondary: "#9C27b0",
    secondary2: "#EFEDF0",
    secondary3: "#CCD2E3",
    secondary4: "#888891",
    secondary5: "#404040",

    fmasecondary: "#686868",
    greyButton: "#F2F2F4",
    lightgrey: "#C7C7C7",
    fmaiconsecondary: "#A8A8A8",
    "almost-black": "#18020C",

    // reds
    fmared: "#FE3C50",
    accent: "#e91e63",
};

function processDataFromHeaders<T>(data: T[], headers: Array<Header<T>> | null): XLSXData {
    const processedData: any[] = [];
    for (const row of data || []) {
        const processedRow = {} as any;
        for (const header of headers || []) {
            if (!header.value) {
                continue;
            }
            if (typeof header.value == "function") {
                processedRow[header.text as any] = header.value?.(row);
            } else {
                processedRow[header.text as any] = rs(header.value, row);
            }
            if (typeof processedRow[header.text as any] == "object") {
                processedRow[header.text as any] = null;
            }
        }
        processedData.push(processedRow);
    }
    return processedData;
}

export interface Header<T = any> {
    text?: string;
    boolean?: boolean;
    required?: boolean;
    number?: boolean;
    list?: string[];
    href?: string | ((row: any) => string);
    value?: string | ((row: T) => string | number);
}

async function downloadXlsx<T>({
    data,
    headers,
    fileName,
    parentDirFullPath,
}: {
    headers?: Array<Header<T>> | null;
    fileName: string;
    data?: T[];
    parentDirFullPath: string;
}) {
    const wb = new ExcelJS.Workbook();

    const worksheet = wb.addWorksheet("Main Sheet", {
        properties: {
            tabColor: {
                argb: "FF00FFFF",
            },
        },
    });

    if (!headers) {
        headers = Object.keys(data?.[0] as any).map((key) => {
            return {
                text: key,
                value: key,
            };
        });
    }

    const Headers = headers;
    // Add an array of header values

    worksheet.columns = Headers?.map((h) => {
        return {
            key: h.text,
            header: h.text,
        };
    });

    // Get the first row
    const headerRow = worksheet.getRow(1);

    // Set the fill property to change the background color to red
    headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: `FF${theme.primary.slice(1)}` },
    };

    // Set the font property to change the text color to white
    headerRow.font = {
        color: { argb: "FFFFFFFF" },
    };

    worksheet.eachColumnKey((col, index) => {
        col.alignment = {
            horizontal: "center",
            vertical: "middle",
        };

        const header = Headers.find((h) => h.text == col.header);
        if (header?.boolean) {
            (worksheet as any).dataValidations.add(`${col.letter}2:${col.letter}9999`, {
                type: "list",
                allowBlank: !!header.required,
                formulae: ['"نعم,لا"'],
            });
        } else if (header?.list?.length) {
            (worksheet as any).dataValidations.add(`${col.letter}2:${col.letter}9999`, {
                type: "list",
                allowBlank: !!header.required,
                formulae: [`"${header.list.join(",")}"`],
            });
        } else if (header?.number) {
            (worksheet as any).dataValidations?.add(`${col.letter}2:${col.letter}9999`, {
                type: "decimal",
                allowBlank: !!header.required,
            });
        } else {
            (worksheet as any).dataValidations?.add(`${col.letter}2:${col.letter}9999`, {
                type: "custom",
                allowBlank: !!header?.required,
            });
        }
    });

    if (data) {
        if (headers?.length) {
            const processed = processDataFromHeaders<T>(data, headers);
            worksheet.addRows(processed);
        } else {
            worksheet.addRows(data);
        }
    }

    worksheet.eachColumnKey((col) => {
        col.width = Number(col.header?.length) + 4;
        col.eachCell((cell) => {
            col.width = Number(col.width) > String(cell.value).length ? col.width : String(cell.value).length + 4;
        });
    });
    const fullFilePath = path.join(parentDirFullPath, fileName);
    await wb.xlsx.writeFile(fullFilePath, {
        filename: fileName,
    });
}

type XLSXData = Array<{ [key: string | number]: string | number }>;

export { downloadXlsx };
