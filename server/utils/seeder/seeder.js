// @ts-nocheck
const { auth, response } = env;

export default (seedMethod) => async (req, res) => {
    try {
        // auth
        if (req.query.key != auth.seedKey) {
            throw {
                error: { name: "not authorized", msg: "please provide seed key" },
                statusCode: response.statusCodes.notAuthorized,
            };
        }

        // Number of entries
        let numberOfEntries = 0;
        numberOfEntries = Math.floor(req.params.no);
        if (!(numberOfEntries > 0)) {
            throw {
                error: { name: "factory error", msg: "not defined factory number" },
                statusCode: response.statusCodes.invalidField,
            };
        }

        // generate
        await seedMethod(numberOfEntries);

        // done
        if (req.baseUrl != "/server/api/factory") {
            return res.status(response.statusCodes.ok).json({
                result: {
                    name: "succeed",
                    msg: `created ${numberOfEntries} mock`,
                },
            });
        } else {
            return;
        }
    } catch (error) {
        console.log(error);
        throw error;
    }
};
