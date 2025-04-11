import client from "$/server/modules/index.js";
import fs from "fs";
import { createPathResolver } from "../../../utils/common/index.js";
async function run() {
    const resolve = createPathResolver(import.meta.url);

    const firstCountry = await client.country.findFirst({
        where: {
            deleted: false,
        },
    });
    if (firstCountry) {
        return;
    }

    const countries = JSON.parse(
        fs.readFileSync(resolve("$/server/assets/Addresses/minimalCountriesCities.json"), "utf-8"),
    );
    for (const country of countries) {
        await client.country.create({
            data: {
                name: country.name,
                cities: {
                    createMany: {
                        data: country.cities.map((cityName) => {
                            return {
                                name: cityName,
                            };
                        }),
                    },
                },
            },
        });
    }
}

export { run };
