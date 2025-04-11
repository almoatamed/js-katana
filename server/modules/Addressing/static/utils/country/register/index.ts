import { Requester } from "../../../../../../utils/express/index.js";
import multirule from "../../../../../../utils/rules/multirules.js";
import requesterFields from "../../../../../utils/requesterFields/index.js";
const client = (await import("../../../../instance/index.js")).AddressingInstanceClient;
type Attrs = {
    name: string;
};
export async function register(requester: Requester | undefined, options: Attrs) {
    await multirule([
        [
            ["required", "title", "unique"],
            options.name,
            "Country Name",
            {
                unique: {
                    model: "country",
                    uniqueKey: "name",
                    parseInt: false,
                    where: {
                        Country: {
                            deleted: false,
                        },
                    },
                },
            },
        ],
    ]);
    const newCountry = await client.country.create({
        data: {
            ...requesterFields.create(requester),
            name: options.name,
        },
    });
    return newCountry;
}
