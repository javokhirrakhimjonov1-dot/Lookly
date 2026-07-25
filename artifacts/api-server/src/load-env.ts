import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

const apiServerRoot = path.dirname(fileURLToPath(import.meta.url));
loadEnvFile(path.resolve(apiServerRoot, "..", ".env"));
loadEnvFile(path.resolve(apiServerRoot, "..", "..", "..", ".env"));
// Reuse the public Supabase URL/key used by the Expo client so the API can
// validate access tokens. These values are publishable; the Gemini key stays
// only in this server's own .env file.
loadEnvFile(path.resolve(apiServerRoot, "..", "..", "lookly", ".env"));
