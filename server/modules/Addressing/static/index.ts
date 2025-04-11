import { AddressingInstanceClient } from "../instance/index.js";
import { findOrCreateIfProvided as findOrCreateCountryIfProvided } from "./utils/country/findOrCreateIfProvided/index.js";
import { register as registerCountry } from "./utils/country/register/index.js";

import { findOrCreateIfProvided as findOrCreateCityIfProvided } from "./utils/city/findOrCreateIfProvided/index.js";
import { register as registerCity } from "./utils/city/register/index.js";

const AddressingStaticClientExtensionArgs = {
    name: "AddressingModuleStaticExtension",
    model: {
        countries: {
            register: registerCountry,
            findOrCreateIfProvided: findOrCreateCountryIfProvided,
        },

        cities: {
            register: registerCity,
            findOrCreateIfProvided: findOrCreateCityIfProvided,
        },
    },
};
const AddressingStaticClient = AddressingInstanceClient.$extends(AddressingStaticClientExtensionArgs);

export { AddressingStaticClient };
export { AddressingStaticClientExtensionArgs };
