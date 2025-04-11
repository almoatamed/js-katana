import Logger from "$/server/utils/cli/logger.js";
import { execSync } from "child_process";
import { getTimezone } from "../../config/timezone/index.js";

const defaultTimezone = getTimezone();
const currentTimezone = execSync("sudo timedatectl show", {
    encoding: "utf-8",
})
    ?.trim()
    .split("\n")?.[0]
    ?.split("=")?.[1];
if (!currentTimezone || currentTimezone != defaultTimezone) {
    execSync(`sudo timedatectl set-timezone ${defaultTimezone}`, {
        encoding: "utf-8",
        stdio: "inherit",
    });
    Logger.success(`> changed time zone to ${defaultTimezone}`);
} else {
    Logger.warning(`> timezone is already ${currentTimezone}`);
}
