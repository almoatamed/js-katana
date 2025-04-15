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
    console.log(`> changed time zone to ${defaultTimezone}`);
} else {
    console.warn(`> timezone is already ${currentTimezone}`);
}
