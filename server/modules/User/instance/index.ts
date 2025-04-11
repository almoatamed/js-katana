import { deactivate } from "./utils/deactivate/index.js";
import { archive } from "./utils/index.js";
import { updatePassword, UpdatePasswordProps } from "./utils/updatePassword/index.js";
import { updateSelf, UpdateSelfParams } from "./utils/updateSelf/index.js";

const { activateUser } = await import("./utils/index.js");

const client = (await import("$/server/utils/database/prisma.js")).default;

const AuthExtension = (await import("./auth/index.js")).InstanceAuthExtension;
const UserInstanceClientExtensionArgs = {
    name: "UserModuleInstanceExtension",
    result: {
        users: {
            auth: AuthExtension,
            activate: {
                compute(user: import("$/prisma/client/index.js").User) {
                    return async (requester: any = undefined) => activateUser(user, requester);
                },
            },
            deactivate: {
                compute(user: import("$/prisma/client/index.js").User) {
                    return async (requester: any = undefined) => deactivate(user, requester);
                },
            },
            archive: {
                compute(user: import("$/prisma/client/index.js").User) {
                    return async (requester: import("$/prisma/client/index.js").User | any = undefined) =>
                        archive(requester, user);
                },
            },
            updatePassword: {
                compute(user: import("$/prisma/client/index.js").User) {
                    return async (
                        params: UpdatePasswordProps,
                        requester: import("$/prisma/client/index.js").User | any = undefined,
                    ) => updatePassword(params, requester, user);
                },
            },
            updateSelf: {
                compute(user: import("$/prisma/client/index.js").User) {
                    return async (params: UpdateSelfParams) => updateSelf(user, params);
                },
            },
        },
    },
};

const UserInstanceClient = client.$extends(UserInstanceClientExtensionArgs);

export { UserInstanceClient, UserInstanceClientExtensionArgs };
