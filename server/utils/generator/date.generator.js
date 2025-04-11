// @ts-nocheck
export default function (days, era = "past") {
    const date = new Date();

    if (era === "past") {
        return new Date(date.setDate(date.getDate() - Math.floor(Math.random() * days)));
    } else if (era === "future") {
        return new Date(date.setDate(date.getDate() + Math.floor(Math.random() * days)));
    }
}
