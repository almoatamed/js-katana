/**
 * @type {any}
 */
const firebaseAdmin = (await import("firebase-admin")).default;
import fs from "fs";
import path from "path";
import rootPaths from "../../dynamicConfiguration/rootPaths.js";
try {
    const srcPath = rootPaths.srcPath;
    const firebaseConfig = JSON.parse(fs.readFileSync(path.join(srcPath, "firebase/FirebaseServerKey.json"), "utf-8"));
    console.log("firebase config", firebaseConfig);

    await firebaseAdmin.initializeApp({
        credential: firebaseAdmin.credential.cert(firebaseConfig),
    });
} catch (error) {
    console.log(error);
}
export default firebaseAdmin;
