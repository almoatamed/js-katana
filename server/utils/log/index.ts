
import cluster from "cluster";
import { dashDateFormater } from "../common/index.js";
import { loggingConfig } from "../../config/logging/index.js";

export const forceLog = console.log;
(console as any)._Log = console.log
if (loggingConfig.hideLogs()) {
    console.log = () => {};
    console.warn = () => {};
    console.info = () => {};
    console.trace = () => {};
}
export const colors = {
    black: "\x1b[30m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
    white: "\x1b[37m",
    consoleColor: "\x1b[0m",
};

type LoggerProps = {
    logLevel: LogLevel;
    logAsWorker: boolean;
    name: string;
    color: LogColor;
};

const Logger = function (options: LoggerProps) {
    let time = "";
    function updateTime() {
        time = dashDateFormater(new Date(), true, true, true);
    }
    const logger = function (...msgs: any[]) {
        if (process.env["NODE_ENV"] === "test") {
            return;
        }

        if (loggingConfig.hideLogs()) {
            return;
        }
        if (cluster.isPrimary || options.logAsWorker) {
            if (!msgs[0]) {
                forceLog();
                return;
            }
            updateTime();
            const consoleLog = `${colors[options.color]}---[${time}]-[ ${process.pid} ]-[ ${String(options.name).toUpperCase()} ]-[ ${String(
                options.logLevel,
            ).toUpperCase()} ]---${colors.consoleColor}`;
            forceLog(consoleLog, ...msgs);
        }
    };

    logger.error = function (...msgs: any[]) {
        if (cluster.isPrimary || options.logAsWorker) {
            if (!msgs[0]) {
                forceLog();
                return;
            }

            updateTime();
            const consoleLog = `${colors[options.color]}---[${time}]-[ ${process.pid} ]-[ ${String(options.name).toUpperCase()} ]-[ ERROR ]---${colors.consoleColor}`;
            forceLog(consoleLog, ...msgs);
        }
    };
    logger.warning = function (...msgs: any[]) {
        if (loggingConfig.hideLogs()) {
            return;
        }
        if (!msgs[0]) {
            forceLog();
            return;
        }

        if (cluster.isPrimary || options.logAsWorker) {
            updateTime();
            const consoleLog = `${colors[options.color]}---[${time}]-[ ${process.pid} ]-[ ${String(options.name).toUpperCase()} ]-[ WARNING ]---${colors.consoleColor}`;
            forceLog(consoleLog, ...msgs);
        }
    };
    return logger;
};

type LogColor = "black" | "red" | "green" | "yellow" | "blue" | "magenta" | "cyan" | "white" | "consoleColor";
type LogLevel = "Info" | "Warning" | "Error";
async function localLogDecorator(
    name: string,
    color: LogColor,
    logToConsole: boolean = false,
    logLevel: LogLevel = "Info",
    worker: boolean = false,
) {
    if (!logLevel) {
        logLevel = "Info";
    }
    name = name.toUpperCase();
    const logger = Logger({ name, logLevel, logAsWorker: worker, color });
    return logger;
}

export const generalLogger = Logger({
    color: "white",
    logAsWorker: true,
    logLevel: "Info",
    name: "General",
});

(console as any).Log = console.log;
console.log = generalLogger;
console.warn = generalLogger.warning;
console.error = generalLogger.error;

export { localLogDecorator };
export default localLogDecorator;
