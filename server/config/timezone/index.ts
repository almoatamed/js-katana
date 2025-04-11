import { getFromEnv } from "../dotEnv.js";
import { Timezone } from "./timezoneTypes.js";

export const getTimezone: () => Timezone = () => {
    const timezone: Timezone | undefined = getFromEnv("TIMEZONE") as Timezone;

    return timezone || "Etc/GMT";
};
