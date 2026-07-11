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
app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

app.use("/api", router);

// Uploads directory for persistent image storage
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.resolve(import.meta.dirname, "../../uploads");
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
  const filePath = path.join(root, decodedPath);
  try {
    const stat = fs.statSync(filePath);
    if (stat.isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      res.status(200);
      res.setHeader("Content-Type", MIME[ext] || "application/octet-stream");
      res.setHeader("Content-Length", stat.size);
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
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
