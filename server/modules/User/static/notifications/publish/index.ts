import mailer from "$/server/utils/email/index.js";
import client from "../../../../../utils/database/prisma.js";
import { EmailGenerator } from "../../../../../utils/emailGenerator/index.js";
import { Requester } from "../../../../../utils/express/index.js";
import ObjectError from "../../../../../utils/ObjectError/index.js";
import multirules from "../../../../../utils/rules/multirules.js";

// target: any, title: string, contents: string, sendEmail?: boolean
type Options = {
    title: string;
    contents: string;
    targets: {
        all: boolean;
        users?: number[];
    };
    sendEmail: boolean;
    requester?: Requester;
    tags: number[];
};

export async function publishNotification(options: Options) {
    await multirules([
        [["required", "title"], options.title, "Notification Title"],
        [["required", "description"], options.contents, "Notification Contents"],
        [["required"], options.targets, "Notification targets"],
        [["array"], options.targets?.users, "Targeted users"],
        [["array"], options.tags, "Tags of notification"],
    ]);

    const users = options.targets.users || [];
    const tags = options.tags || [];

    if (users) {
        const foundUsers = await client.user.findMany({
            where: {
                userId: {
                    in: users,
                },
            },
        });
        if (foundUsers?.length != users.length) {
            throw new ObjectError({
                statusCode: 400,
                error: {
                    msg: "Users Not found",
                },
            });
        }
    }

    if (tags) {
        const foundTags = await client.notificationTag.findMany({
            where: {
                tagId: {
                    in: tags,
                },
            },
        });
        if (foundTags?.length != tags.length) {
            throw new ObjectError({
                statusCode: 400,
                error: {
                    msg: "Tags Not found",
                },
            });
        }
    }

    await client.$transaction(async (tx) => {
        const fetchTargets = async () => {
            if (options.targets.all) {
                const users = await tx.user.findMany({ select: { userId: true } });
                return users.map((u) => u.userId);
            }

            const targetsArr = [...users];

            return Array.from(new Set(targetsArr));
        };

        const resource = await tx.notificationResource.create({
            data: {
                title: options.title,
                contents: options.contents,
                tags: {
                    createMany: {
                        data: [
                            ...tags.map((tag) => ({
                                tagId: tag,
                            })),
                        ],
                    },
                },
            },
        });

        const fullTargetsList = await fetchTargets();
        await tx.userNotification.createMany({
            data: fullTargetsList.map((uId) => {
                return {
                    userId: uId,
                    notificationResourceId: resource.resourceId,
                };
            }),
        });

        if (options.sendEmail) {
            const emails = (
                await tx.user.findMany({
                    where: {
                        userId: { in: fullTargetsList },
                    },
                })
            )
                .map((u) => u.email)
                .filter((e) => !!e);

            const mailGen = new EmailGenerator();
            const doc = await mailGen.generateDocument({
                direction: "ltr",
                title: "Notification",
                subtitle: "you have new notification",
                content: [
                    {
                        title: options.title,
                        text: options.contents,
                    },
                ],
                endingMessage: `Thank you for choosing TripoliDevs`,
            });
            mailer
                .send({
                    to: emails,
                    subject: options.title,
                    html: doc.template.wrappedFinalHtml,
                })
                .catch((error) => {
                    console.log(error);
                });
        }
    });
}
