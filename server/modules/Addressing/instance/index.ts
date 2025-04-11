const client = (await import("$/server/utils/database/prisma.js")).default;

const AddressingInstanceClientExtensionArgs = {
    name: "AddressingModuleInstanceExtension",
    result: {},
};

const AddressingInstanceClient = client.$extends(AddressingInstanceClientExtensionArgs);

export { AddressingInstanceClientExtensionArgs };
export { AddressingInstanceClient };
