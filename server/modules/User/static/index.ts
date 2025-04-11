import { activate, archive, deactivate, deleteUser, register, update, updatePassword } from "./utils/index.js";

import { UserInstanceClient } from "../instance/index.js";
import { changeNotificationStatus } from "./notifications/changeStatus/index.js";
import { publishNotification } from "./notifications/publish/index.js";
import { registerTag } from "./notifications/tags/register/index.js";
import { updateTag } from "./notifications/tags/update/index.js";
import { deleteOneTag } from "./notifications/tags/deleteOne/index.js";
import updatePhone from "./utils/updatePhone/index.js";

const AuthExtension = (await import("./auth/index.js")).StaticAuthExtension;
const UserStaticClientExtensionArgs = {
    name: "UserModuleStaticExtension",
    model: {
        user: {
            auth: AuthExtension,
            register: register,
            archive: archive,
            deleteUser: deleteUser,
            deactivate: deactivate,
            activate: activate,
            updateProfile: update,
            updatePassword: updatePassword,
            updatePhone: updatePhone,
        },
        userNotification: {
            changeStatus: changeNotificationStatus,
            publish: publishNotification,
        },
        notificationTag: {
            register: registerTag,
            updateOne: updateTag,
            deleteOne: deleteOneTag,
        },
    },
};
const UserStaticClient = UserInstanceClient.$extends(UserStaticClientExtensionArgs);
export { UserStaticClient };
export { UserStaticClientExtensionArgs };
