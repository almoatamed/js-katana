const randomNames = [
    "ahmad",
    "mohammad",
    "yasmin",
    "moyasser",
    "fisal",
    "fadil",
    "fauzi",
    "zaher",
    "naser",
    "karim",
    "younis",
    "loay",
    "reyad",
    "nader",
    "wajeeh",
    "mohanned",
    "ramez",
    "samir",
    "yaser",
    "majed",
    "majeed",
    "ramadan",
    "said",
    "musa",
    "yousef",
    "abdolrahaman",
    "abdolqader",
];

export default function (n) {
    let name = [];
    for (let i = 0; i < n; i++) {
        name.push(randomNames[Math.floor(Math.random() * randomNames.length)]);
    }
    return name.join(" ");
}
