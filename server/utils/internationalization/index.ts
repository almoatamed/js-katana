const fs = (await import("fs")).default;
import { lockMethod, readVolatileJSON } from "$/server/utils/common/index.js";
import path from "path";
import rootPaths from "../dynamicConfiguration/rootPaths.js";

export type LanguagesKey = "ar" | "en";

export type LanguageIdentifier = {
    englishName: string;
    direction: "rtl" | "ltr";
    nativeName: string;
    key: LanguagesKey;
    resourcePath: string;
};

const arFullPath = path.join(rootPaths.srcPath, "internationalization/translations/ar.lang.json");
const enFullPath = path.join(rootPaths.srcPath, "internationalization/translations/en.lang.json");

const availableLanguages: {
    [key in LanguagesKey]: LanguageIdentifier;
} = {
    ar: {
        englishName: "Arabic",
        nativeName: "العربية",
        key: "ar",
        direction: "rtl",
        resourcePath: arFullPath,
    },
    en: {
        englishName: "English",
        nativeName: "English",
        key: "en",
        direction: "ltr",
        resourcePath: enFullPath,
    },
};
const defaultLanguage = availableLanguages.en;

type LanguageMap = {
    nativeName: string;
    key: LanguagesKey;
    englishName: string;
    direction: "rtl" | "ltr";
    map: {
        [key: string]: string | undefined;
    };
};

export const resources: {
    [key in LanguagesKey]: LanguageMap;
} = {
    ar: readVolatileJSON<LanguageMap>(arFullPath, {
        createIfNotExists: true,
        defaultValue: {
            englishName: "Arabic",
            nativeName: "العربية",
            key: "ar",
            direction: "rtl",
            map: {},
        } as LanguageMap,
    }) as LanguageMap,
    en: readVolatileJSON<LanguageMap>(enFullPath, {
        createIfNotExists: true,
        defaultValue: {
            englishName: "English",
            nativeName: "English",
            key: "en",
            map: {},
        } as LanguageMap,
    }) as LanguageMap,
};
for (const resource of Object.values(resources)) {
    for (const phrase in resource?.map || {}) {
        const lowerPhrase = String(phrase).toLowerCase();
        resource.map[lowerPhrase] = resource.map[phrase];
    }
}

const languageLogFileFromKey = (languageKey: string) => {
    return `${languageKey}.log.json`;
};

const createLogFileIfNotExists = (languageKey: string) => {
    const logFileFullPath = path.join(
        rootPaths.srcPath,
        "internationalization/logs",
        languageLogFileFromKey(languageKey),
    );

    const logFileParentDirFullPath = path.dirname(logFileFullPath);
    fs.mkdirSync(logFileParentDirFullPath, {
        recursive: true,
    });

    if (!fs.existsSync(logFileFullPath)) {
        fs.writeFileSync(
            logFileFullPath,
            JSON.stringify(
                {
                    notFoundTranslations: [],
                },
                null,
                4,
            ),
        );
    }
    return logFileFullPath;
};

type LangLogFile = {
    notFoundTranslations: string[];
};

export const addToLog = lockMethod(
    (languageKey: string, phrase: string) => {
        phrase = phrase.trim().toLowerCase();
        const logFileFullPath = createLogFileIfNotExists(languageKey);
        const log = JSON.parse(fs.readFileSync(logFileFullPath, "utf-8")) as LangLogFile;
        if (!log.notFoundTranslations.find((ph) => ph == phrase)) {
            log.notFoundTranslations.push(phrase);
            fs.writeFileSync(logFileFullPath, JSON.stringify(log, null, 4));
        }
    },
    { lockName: "logNotFoundTranslation" },
);

/**
 *
 * @param {string} phrase
 * @param {AvailableLanguages} [languageKey]
 */
const t = (phrase: string, languageKey?: LanguagesKey): string => {
    if (!phrase || typeof phrase != "string") {
        return phrase;
    }
    phrase = String(phrase).toLowerCase();
    if (!languageKey || !availableLanguages[languageKey]) {
        languageKey = defaultLanguage.key;
    }
    const resource = resources[languageKey];
    if (resource?.map?.[phrase]) {
        return resource?.map?.[phrase] as string;
    }

    if (languageKey != defaultLanguage.key) {
        addToLog(languageKey, phrase)
            .then(() => {})
            .catch((error) => {
                console.log("Error logging to unfound translation", error);
            });
    }

    return phrase;
};
export { availableLanguages, defaultLanguage, t };
