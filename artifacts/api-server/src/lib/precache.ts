import { removeBackground } from "@imgly/background-removal-node";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { logger } from "./logger";

const WARMUP_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const require = createRequire(import.meta.url);
const backgroundRemovalPackageDir = path.resolve(
  path.dirname(require.resolve("@imgly/background-removal-node")),
  "..",
);
const backgroundRemovalPublicPath = pathToFileURL(
  path.join(backgroundRemovalPackageDir, "dist") + path.sep,
).href;

export async function warmupBackgroundRemoval(): Promise<void> {
  try {
    logger.info("Pre-caching background-removal model...");
    const buf = Buffer.from(WARMUP_PNG_BASE64, "base64");
    const blob = new Blob([buf], { type: "image/png" });
    await removeBackground(blob as any, {
      publicPath: backgroundRemovalPublicPath,
      model: "medium",
      output: {
        format: "image/png",
        quality: 0.8,
      },
    });
    logger.info("Background-removal model cached successfully");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ err: msg }, "Background-removal model warmup failed");
  }
}
