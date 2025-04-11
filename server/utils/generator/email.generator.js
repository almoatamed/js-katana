// @ts-nocheck
const uname = (await import("unique-names-generator")).default;

const config = { separator: " ", style: "capital", length: "2", dictionaries: [uname.names, uname.colors, uname.adjectives, uname.animals, uname.countries] };

export default function () {
    const emailUsername = uname.uniqueNamesGenerator(config).replaceAll(" ", "-");
    config.length = 1;
    const emailDomain = uname.uniqueNamesGenerator(config).replaceAll(" ", "-");
    return `${emailUsername}@${emailDomain}.com`;
}
