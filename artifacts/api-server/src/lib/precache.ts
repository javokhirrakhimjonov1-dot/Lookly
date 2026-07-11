import { removeBackground } from "@imgly/background-removal-node";
import { logger } from "./logger";

const WARMUP_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

export async function warmupBackgroundRemoval(): Promise<void> {
  try {
    logger.info("Pre-caching background-removal model...");
    const buf = Buffer.from(WARMUP_PNG_BASE64, "base64");
    const blob = new Blob([buf], { type: "image/png" });
    await removeBackground(blob as any, {
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
