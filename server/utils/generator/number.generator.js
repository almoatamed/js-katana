export default (length) => {
    let no = "";
    for (let i = 0; i < length; i++) {
        no += Math.floor(Math.random() * 10);
    }
    return no;
};
