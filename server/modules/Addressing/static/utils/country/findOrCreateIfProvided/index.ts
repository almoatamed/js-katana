import { Requester } from "../../../../../../utils/express/index.js";
import multirule from "../../../../../../utils/rules/multirules.js";
import { register } from "../register/index.js";
const client = (await import("../../../../instance/index.js")).AddressingInstanceClient;

type Attrs = {
    name?: string;
};

export async function findOrCreateIfProvided(requester: Requester | undefined, options: Attrs) {
    await multirule([[["title"], options.name, "Country Name"]]);
    if (options.name) {
        const country = await client.country.findFirst({
            where: {
                deleted: false,
                name: options.name,
            },
        });
        if (country) {
            return country;
        } else {
            return await register(requester, {
                name: options.name,
            });
        }
    } else {
        return null;
    }
}
