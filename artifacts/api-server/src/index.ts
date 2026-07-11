import "./load-env";
import app from "./app";
import { logger } from "./lib/logger";
import { initDb } from "./lib/db";
import { warmupBackgroundRemoval } from "./lib/precache";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function startup(): Promise<void> {
  await initDb();
  logger.info("SQLite database initialized");

  warmupBackgroundRemoval();

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
  });
}

startup().catch((err) => {
  logger.error({ err }, "Failed to start server");
  process.exit(1);
});
