import { Requester } from "../../../utils/express/index.js";

export default function (requester: Requester | undefined) {
    return {
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
