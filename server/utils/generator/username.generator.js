export default function (name) {
    let initial = "_";
    if (name) {
        initial = name.match(/\b(\w)/g).join("");
    }
    return initial + Math.floor(Math.random() * 10) + Math.floor(Math.random() * 10) + Math.floor(Math.random() * 10);
}
