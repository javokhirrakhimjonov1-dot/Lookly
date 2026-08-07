import { logger } from "./logger";
import { warmupProductImageNormalizer } from "./productImageNormalization";

export async function warmupBackgroundRemoval(): Promise<void> {
  try {
    logger.info("Pre-caching background-removal model...");
    await warmupProductImageNormalizer();
    logger.info("Background-removal model cached successfully");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ err: msg }, "Background-removal model warmup failed");
  }
}
