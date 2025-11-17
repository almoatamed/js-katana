import { forceLog } from "kt-logger";
import { dashDateFormatter } from "kt-common";

type LogColor = "black" | "red" | "green" | "yellow" | "blue" | "magenta" | "cyan" | "white" | "consoleColor";
type LogLevel = "Info" | "Warning" | "Error";

export class TransactionLogger {
    logs: {
        msgs: string[];
        level: LogLevel;
        color: LogColor;
    }[];
    name: string;

    constructor(name: string) {
        this.name = name;
        this.logs = [];
    }
    log(color: LogColor, ...msgs: any[]) {
        this.logs.push({
            msgs,
            color: color,
            level: "Info",
        });
        return this;
    }
    error(color: LogColor, ...msgs: any[]) {
        this.logs.push({
            msgs,
            color: color,
            level: "Error",
        });
        return this;
    }
    warn(color: LogColor, ...msgs: any[]) {
        this.logs.push({
            msgs,
            color: color,
            level: "Warning",
        });
        return this;
    }
    colors = {
        black: "\x1B[30m",
        red: "\x1B[31m",
        green: "\x1B[32m",
        yellow: "\x1B[33m",
        blue: "\x1B[34m",
        magenta: "\x1B[35m",
        cyan: "\x1B[36m",
        white: "\x1B[37m",
        consoleColor: "\x1B[0m",
    };
    out() {
        const time = dashDateFormatter(new Date(), {
            getDate: true,
            getTime: true,
            getMilliseconds: true,
            dateFormat: "yyyy-mm-dd",
            rtl: false,
        });

        for (const log of this.logs.splice(0)) {
            const consoleLog = `${this.colors[log.color]}---[${time}]-[ ${process.pid} ]-[ ${String(
                this.name
            ).toUpperCase()} ]-[ ${String(log.level).toUpperCase()} ]---${this.colors.consoleColor}`;
            forceLog(consoleLog, ...log.msgs);
        }
    }
}
