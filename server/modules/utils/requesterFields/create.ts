import { Requester } from "../../../utils/express/index.js";

export default function (requester: Requester | undefined) {
    return {
        createdAt: new Date(),
        createdByUser: !requester?.userId
            ? undefined
            : {
                  connect: {
                      userId: requester.userId,
                  },
              },
        createdByUserUsername: requester?.username,
        createdByUserFullName: requester?.fullName,
        updatedAt: new Date(),
        updatedByUser: !requester?.userId
            ? undefined
            : {
                  connect: {
                      userId: requester.userId,
                  },
              },
        updatedByUserUsername: requester?.username,
        updatedByUserFullName: requester?.fullName,
    };
}
