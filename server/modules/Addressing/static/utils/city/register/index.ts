import { Requester } from "../../../../../../utils/express/index.js";
import multirule from "../../../../../../utils/rules/multirules.js";
import requesterFields from "../../../../../utils/requesterFields/index.js";
const client = (await import("../../../../instance/index.js")).AddressingInstanceClient;

type Attrs = {
    countryId: number;
    cityName: string;
    [key: string]: any;
};

export async function register(requester: Requester | undefined, options: Attrs) {
    await multirule([
        [
            ["required", "number", "exists"],
            options.countryId,
            "Country ID",
            {
                number: {
                    min: 1,
                },
                exists: {
                    model: "country",
                    parseInt: false,
                    idKey: "countryId",
                },
            },
            {
                exists: {
                    obj: options,
                    key: "country",
                },
            },
        ],
        [
            ["required", "title", "unique"],
            options.cityName,
            "City Name",
            {
                unique: {
                    model: "city",
                    uniqueKey: "name",
                    parseInt: false,
                },
            },
        ],
    ]);

    return await client.city.create({
        data: {
            ...requesterFields.create(requester),
            name: options.cityName,
            country: {
                connect: {
                    countryId: options.countryId,
                },
            },
        },
    });
}
