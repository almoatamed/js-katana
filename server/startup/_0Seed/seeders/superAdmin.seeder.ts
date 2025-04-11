import { encryptionConfig } from "../../../config/encryption/index.js";

const client = (await import("$/server/utils/database/prisma.js")).default;

// encryption
const bcrypt = (await import("bcrypt")).default;

const admin = await client.user.findFirst({
    where: {
        username: "admin",
    },
});

if (!admin) {
    const hash = bcrypt.hashSync("admin", await encryptionConfig.getSaltOrRounds());
    await client.user.create({
        data: {
            fullName: "Super Administrative User",
            username: "admin",
            active: true,
            archived: false,

            password: hash,
            userType: "ADMIN",
        },
    });
}
export default {};
