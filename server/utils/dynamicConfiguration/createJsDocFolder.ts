
import fs from "fs"; 
import url from "url"
const jsDocPath = url.fileURLToPath(new url.URL("./../utils/JsDoc/assets", import.meta.url)); 

if(!fs.existsSync(jsDocPath)){
    fs.mkdirSync(jsDocPath, {
        recursive: true, 
    })
}