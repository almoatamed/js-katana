const noGen = (await import("./number.generator.js")).default;
const phoneKeys = ["091", "0021891", "092", "0021892", "094", "0021894", "021", "0021821"];

export default () => {
    return "" + phoneKeys[Math.floor(Math.random() * phoneKeys.length)] + noGen(7);
};
