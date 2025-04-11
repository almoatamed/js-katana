import client from "../../../../../../utils/database/prisma.js";
import { Requester } from "../../../../../../utils/express/index.js";
import multirules from "../../../../../../utils/rules/multirules.js";

type Options = {
    tagId: number;
    label?: string;
    color?: string;
    requester: Requester;
};

export async function deleteOneTag(opts: Options) {
    await multirules([
        [
            ["required", "number", "exists"],
            opts.tagId,
            "Tag ID",
            { number: { min: 0 }, exists: { model: "notificationTag", idKey: "tagId", parseInt: true } },
        ],
        [["description"], opts.label, "Tag Label"],
        [["description"], opts.color, "Tag Color"],
    ]);

    return await client.$transaction(async (tx) => {
        const now = new Date();

        const tag = await tx.notificationTag.update({
            where: { tagId: opts.tagId },
            data: {
                deleted: true,

                updatedAt: now,

                updatedByUserId: opts.requester.userId,
                updatedByUserFullName: opts.requester.fullName,
                updatedByUserUsername: opts.requester.username,
            },
        });

        return tag;
    });
}
