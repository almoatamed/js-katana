process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
import "dotenv";
await import("./createJsDocFolder.js");
await import("./endpoints.js");
await import("./dbModels.js");
await import("./rootPaths.js");
export default {};
