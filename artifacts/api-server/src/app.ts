import express, { type Express, type Request, type Response, type NextFunction } from "express";
import path from "node:path";
import fs from "node:fs";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
const localOrigins = new Set([
  "http://localhost:5000",
  "http://localhost:8081",
  "http://localhost:8082",
  "http://127.0.0.1:5000",
  "http://127.0.0.1:8081",
  "http://127.0.0.1:8082",
]);
const productionOrigins = (process.env.CORS_ORIGIN ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function isPrivateLanOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    const parts = hostname.split(".").map(Number);
    if (parts.length !== 4 || parts.some(Number.isNaN)) return false;
    return parts[0] === 10
      || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
      || (parts[0] === 192 && parts[1] === 168);
  } catch {
    return false;
  }
}

app.use(cors({
  origin(origin, callback) {
    // Native app requests have no Origin header. Browser requests are limited
    // to localhost while developing and to the configured web domain in prod.
    if (!origin) return callback(null, true);
    const allowed = process.env.NODE_ENV === "production"
      ? productionOrigins.includes(origin)
      : localOrigins.has(origin) || isPrivateLanOrigin(origin);
    return callback(allowed ? null : new Error("Origin is not allowed"), allowed);
  },
}));
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

app.use("/api", router);

// Uploads directory for persistent image storage
// Keep this in sync with remove-bg.ts. Both run from the compiled dist folder
// and must use the same project-level uploads directory.
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.resolve(import.meta.dirname, "../../../uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Serve uploaded files
app.use("/uploads", (req, res, next) => serveStatic(UPLOADS_DIR, req, res, next));

// Serve web app build if it exists
const webDist = process.env.WEB_DIST || path.resolve(import.meta.dirname, "../../lookly/dist");

// MIME types for font files (some may not be in Express defaults)
const MIME: Record<string, string> = {
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".js": "application/javascript",
  ".css": "text/css",
  ".html": "text/html",
  ".json": "application/json",
};

// Serve static files manually (bypasses Express sendFile which fails for long paths on Windows)
function serveStatic(root: string, req: Request, res: Response, next: NextFunction): void {
  if (req.method !== "GET" && req.method !== "HEAD") return next();
  if (req.path.startsWith("/api")) return next();
  const decodedPath = decodeURIComponent(req.path);
  const resolvedRoot = path.resolve(root);
  const filePath = path.resolve(resolvedRoot, `.${decodedPath}`);
  // Do not let a URL such as /uploads/../data/lookly.db leave the public folder.
  // The root URL resolves to the static directory itself. It is safe and
  // must reach the SPA fallback below; only paths outside the static folder
  // are forbidden.
  if (filePath !== resolvedRoot && !filePath.startsWith(`${resolvedRoot}${path.sep}`)) {
    res.status(403).end();
    return;
  }
  try {
    const stat = fs.statSync(filePath);
    if (stat.isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      res.status(200);
      res.setHeader("Content-Type", MIME[ext] || "application/octet-stream");
      res.setHeader("Content-Length", stat.size);
      res.setHeader("Accept-Ranges", "bytes");
      // Hashed JS/CSS/assets are safe to cache forever. The HTML app shell and
      // Expo metadata must be revalidated so an iPhone reload picks up the
      // newest bundle after a local restart.
      res.setHeader(
        "Cache-Control",
        ext === ".html" || path.basename(filePath) === "metadata.json"
          ? "no-store"
          : "public, max-age=31536000, immutable",
      );
      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
      stream.on("error", () => { if (!res.headersSent) res.status(500).end(); });
      return;
    }
  } catch {}
  next();
}

if (fs.existsSync(webDist)) {
  logger.info({ webDist }, "Serving web app from");
  app.use((req, res, next) => serveStatic(webDist, req, res, next));
  app.use((req, res, next) => {
    if (req.method !== "GET") return next();
    if (req.path.startsWith("/api")) return next();
    const indexPath = path.join(webDist, "index.html");
    if (fs.existsSync(indexPath)) {
      res.setHeader("Cache-Control", "no-store");
      res.type("text/html");
      res.sendFile(indexPath);
    } else {
      next();
    }
  });
} else {
  logger.warn({ webDist }, "Web dist not found — API only");
}

export default app;
