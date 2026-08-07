import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = resolve(packageRoot, "../..");
const looklyRoot = join(workspaceRoot, "artifacts", "lookly");
const cases = [
  [join(packageRoot,"src","engine","weatherEngine.acceptance.test.ts"), join(packageRoot,"dist","weatherEngine.test.mjs")],
  [join(packageRoot,"src","engine","womensParity.acceptance.test.ts"), join(packageRoot,"dist","womensParity.test.mjs")],
  [join(packageRoot,"src","engine","hijabParity.acceptance.test.ts"), join(packageRoot,"dist","hijabParity.test.mjs")],
  [join(packageRoot,"src","routes","recognitionTaxonomy.acceptance.test.ts"), join(packageRoot,"dist","recognitionTaxonomy.test.mjs")],
  [join(packageRoot,"src","lib","productImageNormalization.acceptance.test.ts"), join(packageRoot,"dist","productImageNormalization.test.mjs")],
  [join(packageRoot,"src","lib","catalogImagePolicy.acceptance.test.ts"), join(packageRoot,"dist","catalogImagePolicy.test.mjs")],
  [join(looklyRoot,"lib","profileRules.acceptance.test.ts"), join(looklyRoot,"dist","profileRules.test.mjs")],
  [join(looklyRoot,"lib","profileStylingPreferences.acceptance.test.ts"), join(looklyRoot,"dist","profileStylingPreferences.test.mjs")],
  [join(looklyRoot,"lib","outfitComposition.acceptance.test.ts"), join(looklyRoot,"dist","outfitComposition.test.mjs")],
  [join(looklyRoot,"lib","modestyRules.acceptance.test.ts"), join(looklyRoot,"dist","modestyRules.test.mjs")],
  [join(looklyRoot,"lib","garmentTone.acceptance.test.ts"), join(looklyRoot,"dist","garmentTone.test.mjs")],
  [join(looklyRoot,"lib","packTripClimate.acceptance.test.ts"), join(looklyRoot,"dist","packTripClimate.test.mjs")],
];
for (const [entryPoint, outfile] of cases) {
  await build({ entryPoints:[entryPoint], outfile, bundle:true, platform:"node", format:"esm", alias:{ "@":looklyRoot }, external:["canvas","@imgly/background-removal-node"], logLevel:"silent" });
  execFileSync(process.execPath, [outfile], { stdio:"inherit" });
}
