import path from "path";
import { srcPath } from "../../../cli/utils/srcPath/index.js";
import { compareShallowRecord } from "../../../common/index.js";
import { define } from "../../definer/index.js";
import { createOdooXmlrpcClient } from "./xmlrpcAdapter/index.js";

type OdooConfiguration = {
    host: string;
    db: string;
    secure: boolean;
    port: number;
    username: string;
    password: string;
    apiKey: string;
};

const stockPickingMoveLineSample = {
    id: 38,
    pickingId: [5, "WH/OUT/00005"],
    moveId: [46, "outgoing shipment/E-COM12: Stock>Customers"],
    companyId: [1, "My Company (San Francisco)"],
    productId: [23, "[E-COM12] Conference Chair (Steel)"],
    productUomId: [1, "Units"],
    productUomCategoryId: [1, "Unit"],
    productCategoryName: "All / Saleable / Office Furniture",
    quantity: 14,
    quantityProductUom: 14,
    picked: false,
    packageId: false,
    packageLevelId: false,
    lotId: false,
    lotName: false,
    resultPackageId: false,
    date: "2024-08-25 12:24:52",
    ownerId: false,
    locationId: [8, "WH/Stock"],
    locationDestId: [5, "Partners/Customers"],
    locationUsage: "internal",
    locationDestUsage: "customer",
    lotsVisible: false,
    pickingPartnerId: [9, "Wood Corner"],
    pickingCode: "outgoing",
    pickingTypeId: [2, "YourCompany: Delivery Orders"],
    pickingTypeUseCreateLots: false,
    pickingTypeUseExistingLots: true,
    pickingTypeEntirePacks: false,
    state: "partiallyAvailable",
    isInventory: false,
    isLocked: true,
    consumeLineIds: [],
    produceLineIds: [],
    reference: "WH/OUT/00005",
    tracking: "none",
    origin: false,
    descriptionPicking: false,
    quantId: false,
    productPackagingQty: 0,
    pickingLocationId: [8, "WH/Stock"],
    pickingLocationDestId: [5, "Partners/Customers"],
    displayName: "[E-COM12] Conference Chair (Steel)",
    createUid: [2, "Mitchell Admin"],
    createDate: "2024-08-25 12:24:52",
    writeUid: [2, "Mitchell Admin"],
    writeDate: "2024-08-25 12:24:52",
};

const stockPickingSample = {
    id: 5,
    activityIds: [],
    activityState: false,
    activityUserId: false,
    activityTypeId: false,
    activityTypeIcon: false,
    activityDateDeadline: false,
    myActivityDateDeadline: false,
    activitySummary: false,
    activityExceptionDecoration: false,
    activityExceptionIcon: false,
    messageIsFollower: false,
    messageFollowerIds: [5],
    messagePartnerIds: [9],
    messageIds: [91],
    hasMessage: true,
    messageNeedaction: false,
    messageNeedactionCounter: 0,
    messageHasError: false,
    messageHasErrorCounter: 0,
    messageAttachmentCount: 0,
    websiteMessageIds: [],
    messageHasSmsError: false,
    name: "WH/OUT/00005",
    origin: "outgoing shipment",
    note: false,
    backorderId: false,
    backorderIds: [],
    returnId: false,
    returnIds: [],
    returnCount: 0,
    moveType: "direct",
    state: "assigned",
    groupId: false,
    priority: "0",
    scheduledDate: "2024-08-27 11:57:42",
    dateDeadline: false,
    hasDeadlineIssue: false,
    date: "2024-08-24 11:57:42",
    dateDone: false,
    delayAlertDate: false,
    jsonPopover: false,
    locationId: [8, "WH/Stock"],
    locationDestId: [5, "Partners/Customers"] as [number, string],
    moveIds: [23] as number[],
    moveIdsWithoutPackage: [23] as number[],
    hasScrapMove: false,
    pickingTypeId: [2, "YourCompany: Delivery Orders"] as [number, string],
    pickingTypeCode: "outgoing",
    pickingTypeEntirePacks: false,
    useCreateLots: false,
    useExistingLots: true,
    hidePickingType: false,
    partnerId: [9, "Wood Corner"],
    companyId: [1, "My Company (San Francisco)"] as [number, string],
    userId: false,
    moveLineIds: [21] as number[],
    moveLineIdsWithoutPackage: [21] as number[],
    moveLineExist: true,
    hasPackages: false,
    showCheckAvailability: false,
    showAllocation: false,
    ownerId: false,
    printed: false,
    signature: false,
    isSigned: false,
    isLocked: true,
    productId: [8, "[FURN_7800] Desk Combination"] as [number, string],
    lotId: false,
    showOperations: false,
    showReserved: true,
    showLotsText: false,
    hasTracking: false,
    packageLevelIds: [],
    packageLevelIdsDetails: [],
    productsAvailability: "Available",
    productsAvailabilityState: "available",
    showSetQtyButton: false,
    showClearQtyButton: false,
    pickingProperties: [],
    displayName: "WH/OUT/00005",
    createUid: [1, "OdooBot"] as [number, string],
    createDate: "2024-08-24 11:57:37",
    writeUid: [1, "OdooBot"] as [number, string],
    writeDate: "2024-08-24 11:57:37",
};

export const odoo = await define({
    buildOperations(props: { getConfiguration: () => Promise<OdooConfiguration> }) {
        async function getUrl() {
            const config = await props.getConfiguration();
            const url = `http${config.secure ? "s" : ""}://${config.host}${config.port == 80 ? "" : `:${config.port}`}/xmlrpc/2/common`;
            console.log(url);
            return url;
        }

        let clientCache = null as null | ReturnType<typeof createOdooXmlrpcClient>;
        let clientConfigCache: {
            db: string;
            password: string;
            url: string;
            username: string;
            port: number;
            secure: boolean;
        } | null = null;

        async function getXmlRpcClient() {
            const config = await props.getConfiguration();
            const url = await getUrl();
            const currentClientConfig = {
                db: config.db,
                password: config.password,
                url: url,
                username: config.username,
                port: config.port,
                secure: config.secure,
            };
            if (clientCache && clientConfigCache && compareShallowRecord(currentClientConfig, clientConfigCache)) {
                return clientCache;
            }
            clientConfigCache = currentClientConfig;
            const odooClient = createOdooXmlrpcClient(currentClientConfig);
            clientCache = odooClient;
            return odooClient;
        }

        async function version() {
            const client = await getXmlRpcClient();
            const versionInfo = await client.version();
            return versionInfo;
        }

        const stockPickingTypeBarcodeToIdMap = {
            "WH-DELIVERY": 2,
            "WH-RECEIPTS": 1,
            "WH-PICK": 3,
            "WH-PACK": 4,
            "WH-INTERNAL": 5,
            "CHIC1-PACK": 9,
            "CHIC1-RECEIPTS": 6,
            "CHIC1-DELIVERY": 7,
            "CHIC1-PICK": 8,
        };

        async function getStockPickingByName(name: string, type?: keyof typeof stockPickingTypeBarcodeToIdMap) {
            const client = await getXmlRpcClient();

            const pickingRecord = (
                await client.executeKw({
                    method: "searchRead",
                    model: "stock.picking",
                    params: [
                        [
                            [
                                ["name", "=", name],
                                !!type && ["pickingTypeId", "=", stockPickingTypeBarcodeToIdMap[type]],
                            ].filter((e) => !!e),
                        ], // domain query
                    ],
                })
            )?.[0] as typeof stockPickingSample;

            const movesRecords: (typeof pickingMoveSample)[] = await client.executeKw({
                method: "searchRead",
                model: "stock.move",
                params: [
                    [[["id", "in", pickingRecord.moveIds]].filter((e) => !!e)], // domain query
                ],
            });

            const movesWithLinesRecords = await Promise.all(
                movesRecords.map(async (m) => {
                    const lines: (typeof stockPickingMoveLineSample)[] = await client.executeKw({
                        method: "searchRead",
                        model: "stock.move.line",
                        params: [
                            [[["id", "in", m.moveLineIds]].filter((e) => !!e)], // domain query
                        ],
                    });

                    return {
                        ...m,
                        lines: lines,
                    };
                }),
            );

            return {
                ...pickingRecord,
                moves: movesWithLinesRecords,
            };
        }

        return {
            getXmlRpcClient,
            version,
            getStockPickingByName,
        };
    },
    definitionId: "OdooErp",
    definitionPath: path.join(srcPath, "systems/odoo"),
    testConnection: () => {
        return true;
    },
});

const pickingMoveSample = {
    id: 46,
    name: "[E-COM12] Conference Chair (Steel)",
    sequence: 10,
    priority: "0",
    date: "2024-08-27 11:57:42",
    dateDeadline: false,
    companyId: [1, "My Company (San Francisco)"] as [number, string],
    productId: [23, "[E-COM12] Conference Chair (Steel)"] as [number, string],
    descriptionPicking: "Conference Chair",
    productQty: 15,
    productUomQty: 15,
    productUom: [1, "Units"] as [number, string],
    productUomCategoryId: [1, "Unit"] as [number, string],
    productTmplId: [16, "Conference Chair"] as [number, string],
    locationId: [8, "WH/Stock"] as [number, string],
    locationDestId: [5, "Partners/Customers"] as [number, string],
    locationUsage: "internal",
    locationDestUsage: "customer",
    partnerId: [9, "Wood Corner"],
    moveDestIds: [],
    moveOrigIds: [],
    pickingId: [5, "WH/OUT/00005"] as [number, string],
    state: "partiallyAvailable",
    picked: false,
    priceUnit: 0,
    origin: false,
    procureMethod: "makeToStock",
    scrapped: false,
    scrapId: false,
    groupId: false,
    ruleId: false,
    propagateCancel: true,
    delayAlertDate: false,
    pickingTypeId: [2, "YourCompany: Delivery Orders"] as [number, string],
    isInventory: false,
    moveLineIds: [38],
    originReturnedMoveId: false,
    returnedMoveIds: [],
    availability: 12,
    restrictPartnerId: false,
    routeIds: [],
    warehouseId: false,
    hasTracking: "none",
    quantity: 14,
    showOperations: false,
    pickingCode: "outgoing",
    showDetailsVisible: false,
    productType: "product",
    additional: true,
    isLocked: true,
    isInitialDemandEditable: false,
    isQuantityDoneEditable: true,
    reference: "WH/OUT/00005",
    moveLinesCount: 1,
    packageLevelId: false,
    pickingTypeEntirePacks: false,
    displayAssignSerial: false,
    displayImportLot: false,
    nextSerial: false,
    nextSerialCount: 0,
    orderpointId: false,
    forecastAvailability: 15,
    forecastExpectedDate: false,
    lotIds: [],
    reservationDate: false,
    productPackagingId: false,
    productPackagingQty: 0,
    productPackagingQuantity: 0,
    showReserved: true,
    showQuant: true,
    showLotsM2o: false,
    showLotsText: false,
    displayName: "outgoing shipment/E-COM12: Stock>Customers",
    createUid: [2, "Mitchell Admin"] as [number, string],
    createDate: "2024-08-25 12:24:52",
    writeUid: [2, "Mitchell Admin"] as [number, string],
    writeDate: "2024-08-25 12:24:52",
};
