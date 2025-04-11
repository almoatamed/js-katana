const colors = {
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

/**
 * @param {"black"|"red"|"green"|"yellow"|"blue"|"magenta"|"cyan"|"white"|"consoleColor"} color
 * @param {String} text
 * @returns {String}
 */
const colorText = (color, text) => {
    return `${colors[color]}${text}${colors.consoleColor}`;
};

export const error = (...message) => {
    console.log(colorText("red", [...message].join(" ")));
};

export const success = (...message) => {
    console.log(colorText("green", [...message].join(" ")));
};

export const warning = (...message) => {
    console.log(colorText("yellow", [...message].join(" ")));
};

export const text = (...message) => {
    console.log(colorText("consoleColor", [...message].join(" ")));
};

export default { error, success, warning, text };
