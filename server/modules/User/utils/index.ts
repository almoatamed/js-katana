const jwt = (await import("$/server/utils/jwt/index.js")).default;
import { User } from "$/prisma/client/index.js";
export async function generateUserJwtToken(user: User): Promise<string> {
    return await jwt.generate({ userId: user.userId, username: user.username });
}
