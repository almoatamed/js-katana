// @ts-nocheck
const uname = (await import("unique-names-generator")).default;

const config = {
    separator: " ",
    style: "capital",
    length: "2",
    dictionaries: [uname.names, uname.colors, uname.adjectives, uname.animals, uname.countries],
};

export default function (n) {
    try {
        let no = Math.floor(n);
        if (no > 0) config.length = no;
    } catch (error) {
        console.log(error);
    }
    return uname.uniqueNamesGenerator(config);
}
