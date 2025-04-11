import { Command } from "commander";
import { encryptionConfig } from "../../../../../../../config/encryption/index.js";
import logger from "../../../../../logger.js";
import { srcPath } from "../../../../../utils/srcPath/index.js";

const createCommand = (program: Command) => {
    program
        .command("generate-user-jwt <userIdentifier>")
        .alias("g-jwt")
        .description("generate user jwt based on his username and credentials")
        .option("--id")
        .option("--userName")
        .action(async (userIdentifier, { id, userName }) => {
            const jwtBase = (await import("jsonwebtoken")).default;
            const jwt = {
                generate: async (obj: any) =>
                    jwtBase.sign(obj, await encryptionConfig.getJwtSecret(), encryptionConfig.getJwtOptions()),
                verify: async (token: string) => {
                    return jwtBase.verify(token, await encryptionConfig.getJwtSecret());
                },
            };
            const client = (await import(`${srcPath}/modules/index.js`)).default;
            async function generateUserJwtToken(user: any): Promise<string> {
                return await jwt.generate({ userId: user.userId, username: user.username });
            }
            let body;
            if (id) {
                body = {
                    userId: +userIdentifier,
                };
            } else {
                if (userName) {
                    body = {
                        userName: userIdentifier,
                    };
                } else {
                    body = {
                        username: userIdentifier,
                    };
                }
            }

            const user = await client.user.findFirst({
                where: {
                    deleted: false,
                    ...body,
                },
            });
            if (!user) {
                logger.error("user not found");
                process.exit();
            }
            logger.success(await generateUserJwtToken(user));
            process.exit();
        });
};
export { createCommand };
