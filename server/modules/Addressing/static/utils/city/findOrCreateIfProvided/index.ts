import { Requester } from "../../../../../../utils/express/index.js";
import multirule from "../../../../../../utils/rules/multirules.js";
import requesterFields from "../../../../../utils/requesterFields/index.js";
const client = (await import("../../../../instance/index.js")).AddressingInstanceClient;

const findOrCreateCountryIfProvided = (await import("../../country/findOrCreateIfProvided/index.js")).findOrCreateIfProvided;
const register = (await import("../register/index.js")).register;

type Attrs = {
    cityName?: string;
    countryName?: string;
};

export async function findOrCreateIfProvided(requester: Requester, options: Attrs) {
    await multirule([
        [["title"], options.cityName, "City Name"],
        [["title"], options.countryName, "Country Name"],
    ]);

    if (options.cityName && options.countryName) {
        const country = await findOrCreateCountryIfProvided(requester, {
            name: options.countryName,
        });
        const city = await client.city.findFirst({
            where: {
                deleted: false,
                name: options.cityName,
                countryId: country?.countryId,
            },
        });
        if (city) {
            return city;
        } else {
            return await register(requester, {
                cityName: options.cityName,
                countryId: (country as any)?.countryId,
            });
        }
    } else {
        return null;
    }
}
