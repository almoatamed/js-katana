import { Requester } from "../../../utils/express/index.js";

export default function (requester: Requester | undefined) {
    return {
        createdAt: new Date(),
        createdByUserId: requester?.userId,
        createdByUserUsername: requester?.username,
        createdByUserFullName: requester?.fullName,
        updatedAt: new Date(),
        updatedByUserId: requester?.userId,
        updatedByUserUsername: requester?.username,
        updatedByUserFullName: requester?.fullName,
    };
}
