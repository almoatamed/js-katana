
const baseClient = (await import("$/server/utils/database/prisma.js")).default;

import { setClient } from "$/server/utils/rules/index.js";
import requesterFields from "$/server/modules/utils/requesterFields/index.js";

const Modules = baseClient
    .$extends({
        client: {
            requesterFields: requesterFields,
        },
    })
    .$extends((await import("$/server/modules/Addressing/instance/index.js")).AddressingInstanceClientExtensionArgs)
    .$extends((await import("$/server/modules/Addressing/static/index.js")).AddressingStaticClientExtensionArgs)
    .$extends((await import("$/server/modules/User/instance/index.js")).UserInstanceClientExtensionArgs)
    .$extends((await import("$/server/modules/User/static/index.js")).UserStaticClientExtensionArgs)

setClient(Modules);

export const client = Modules;
export type ModulesType = typeof Modules;
export default Modules;
