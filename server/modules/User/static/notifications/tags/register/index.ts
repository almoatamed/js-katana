import client from "../../../../../../utils/database/prisma.js";
import { Requester } from "../../../../../../utils/express/index.js";
import multirules from "../../../../../../utils/rules/multirules.js";

type Options = {
    label: string;
    color: string;
    requester: Requester;
};

export async function registerTag(opts: Options) {
    await multirules([
        [["required", "description"], opts.label, "Tag Label"],
        [["required", "description"], opts.color, "Tag Color"],
    ]);

    return await client.$transaction(async (tx) => {
        const now = new Date();

        const tag = await tx.notificationTag.create({
            data: {
                label: opts.label,
                color: opts.color,

                createdAt: now,

                createdByUserId: opts.requester.userId,
                createdByUserFullName: opts.requester.fullName,
                createdByUserUsername: opts.requester.username,

                updatedAt: now,

                updatedByUserId: opts.requester.userId,
                updatedByUserFullName: opts.requester.fullName,
                updatedByUserUsername: opts.requester.username,
            },
        });

        return tag;
    });
}
