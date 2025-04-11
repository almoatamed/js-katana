const generateUserJwtToken = (await import("../../utils/index.js")).generateUserJwtToken;

const InstanceAuthExtension = {
    compute(user) {
        return {
            getUserJwtToken: () => generateUserJwtToken(user),
        };
    },
};

export { InstanceAuthExtension };
