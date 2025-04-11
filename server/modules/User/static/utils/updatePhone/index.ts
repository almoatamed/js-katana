import { Requester } from "../../../../../utils/express/index.js";
import multirule from "../../../../../utils/rules/multirules.js";
import client from "$/server/utils/database/prisma.js";

type Params = {
    requester: Requester;
    nextPhone: string;
};

export default async function updatePhone(params: Params) {
    await multirule([[["required", "phone"], params.nextPhone, "Next phone number"]]);

    return await client.$transaction(
        async (tx) => {


            const updatedUser = await tx.user.update({
                where: {
                    userId: params.requester.userId,
                },
                data: {
                    phone: params.nextPhone,
                },
            });
            return updatedUser
        },
        { timeout: 60_000 },
    );
}
