// Copies the compiled native router (native/target/release/) into dist/native/
// as the platform-named .node module that the runtime loads via
// `getNativeRouter()`. Requires the release build to exist (see `build:native`).
// Skips gracefully when the crate hasn't been compiled yet (e.g. no Rust
// toolchain) so `npm run build` always succeeds.
import { copyFileSync, existsSync, mkdirSync } from "fs";
import path from "path";

const repoRoot = path.join(import.meta.dirname, "..");
const extension = process.platform === "darwin" ? "dylib" : process.platform === "win32" ? "dll" : "so";
const libName = process.platform === "win32" ? "js_kt_native_router" : "libjs_kt_native_router";

const source = path.join(repoRoot, "native", "target", "release", `${libName}.${extension}`);
const outputDir = path.join(repoRoot, "dist", "native");
const output = path.join(outputDir, `js-kt-native.${process.platform}-${process.arch}.node`);

if (!existsSync(source)) {
    console.log("native router crate not built yet; skipping copy (run `npm run build:native` to enable it)");
    process.exit(0);
}

mkdirSync(outputDir, { recursive: true });
copyFileSync(source, output);
console.log(`native router module -> ${output}`);
