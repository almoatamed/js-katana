const LoremIpsum = (await import("lorem-ipsum")).LoremIpsum;

const config = {
    sentencesPerParagraph: {
        max: 8,
        min: 4,
    },
    wordsPerSentence: {
        max: 16,
        min: 4,
    },
};

const lorem = new LoremIpsum(config);

const types = {
    p: "generateParagraphs",
    s: "generateSentences",
    w: "generateWords",
};

/**
 *
 * @param {Number} n number of elements
 * @param {"s"|"w"|"p"} type type either sentance, word or paragraph
 * @returns {string}
 */
function generateText(n, type = "p") {
    return lorem[types[type]](n);
}

export default generateText;
