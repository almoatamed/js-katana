import fs from "fs";
import path from "path";
import logger from "../../../../logger.js";
import { appPath } from "../../../../utils/appPath/index.js";
const utilsPath = path.join(appPath, "server", "utils");

const rawSchema = fs.readFileSync(path.join(appPath, "prisma", "schema.prisma"), "utf-8");

const generator = rawSchema.match(/(\s*?generator\s*?([a-zA-Z_]*?)\s*?\{(?:\n|.)*?)\}/i)![0];
const datasource = rawSchema.match(/(\s*?datasource\s*?([a-zA-Z_]*?)\s*?\{(?:\n|.)*?)\}/i)![0];

const models = [...rawSchema.matchAll(/\n(\s*?model\s*?([a-zA-Z_]*?)\s*?\{(?:\n|.)*?)\}/gi)];
const modelsNames = models.map((m) => {
    console.log(m[2]);
    return m[2];
});

const enums = [...rawSchema.matchAll(/\n(\s*?enum\s*?([a-zA-Z_]*?)\s*?\{(?:\n|.)*?\})/gi)];
const defaultModelAddition = `
    createdByUserId         Int?        
    createdByUserUsername   String?     
    createdByUserFullName  String?     
    updatedByUserId         Int?        
    updatedByUserUsername   String?     
    updatedByUserFullName  String?     
    createdAt                 DateTime?   @default(now())
    updatedAt                 DateTime?   @updatedAt
    deleted                   Boolean?    @default(false)
    createdByUser             User?      @relation("[clampedmodel]CreatedByUserToUser", fields: [createdByUserId], references: [userId])
    updatedByUser             User?      @relation("[clampedmodel]UpdatedByUserToUser", fields: [updatedByUserId], references: [userId])
    @@index([createdByUserId])
    @@index([updatedByUserId])
    @@index([deleted])
`;
const UserCreatedUpdatedRelations = `
    created[model] [model][] @relation("[clampedmodel]CreatedByUserToUser")
    updated[model] [model][] @relation("[clampedmodel]UpdatedByUserToUser")
`;
const fullModels: string[] = [];
const userModelAdditions: string[] = [];

for (const model of models.filter((el) => el[2] != "User")) {
    console.log("building Main model for: ", model[2]);

    fullModels.push(`
   
${model[1]}
    
    ${defaultModelAddition.replaceAll("[model]", model[2]).replaceAll("[clampedmodel]", model[2]).replaceAll("[random]", `${model[2]}`)}   

}
    `);

    userModelAdditions.push(
        UserCreatedUpdatedRelations.replaceAll("[model]", model[2]).replaceAll("[clampedmodel]", model[2]),
    );
}

const userModel = models.find((m) => m[2] == "User")!;

userModelAdditions.push(
    UserCreatedUpdatedRelations.replaceAll("[model]", userModel[2]).replaceAll("[clampedmodel]", userModel[2]),
);

fullModels.push(`

${userModel[1]}

    ${defaultModelAddition.replaceAll("[model]", userModel[2]).replaceAll("[clampedmodel]", userModel[2])}   

    ${userModelAdditions.join("\n\n")}
}
`);

fs.writeFileSync(
    path.join(appPath, "prisma", "mainSchema.prisma"),
    `
    ${generator}
    ${datasource}

    ${enums.map((el) => el[0]).join("\n")}

    ${fullModels.join("\n")}

`,
);

const modelsJsdocPath = `${utilsPath}/JsDoc/assets/models.js`;
fs.mkdirSync(path.dirname(modelsJsdocPath), {
    recursive: true,
});
fs.writeFileSync(
    modelsJsdocPath,
    `
/**
 * @typedef {${modelsNames.map((el) => `"${el[0].toLowerCase() + el.slice(1)}"`).join("|")}} Model
 * 
 */
export default {}
`,
);

logger.success("Generated Main Schema Successfully!!");
