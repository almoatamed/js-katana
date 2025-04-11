import { createCommand as generateUserJwt } from "./generateUserJwt/index.js";

const createCommands = (program) => {
    generateUserJwt(program);
};

export { createCommands };
