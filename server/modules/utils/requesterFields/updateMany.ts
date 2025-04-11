import { Requester } from "../../../utils/express/index.js";

export default function (requester: Requester | undefined) {
    return {
        updatedAt: new Date(),
        updatedByUserId: requester?.userId,
        updatedByUserUsername: requester?.username,
        updatedByUserFullName: requester?.fullName,
    };
}
