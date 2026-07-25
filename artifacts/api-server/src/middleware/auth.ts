import type { RequestHandler } from "express";

type CachedUser = { id: string; expiresAt: number };
const userCache = new Map<string, CachedUser>();
const CACHE_TTL_MS = 60_000;

function supabaseConfig(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && key ? { url: url.replace(/\/$/, ""), key } : null;
}

/** Require a valid Supabase access token before any AI or user-data request. */
export const requireAuthenticatedUser: RequestHandler = async (req, res, next) => {
  // Local development is not publicly reachable. Keeping this bypass here
  // lets the Expo app work while testing without weakening the deployed API.
  if (process.env.NODE_ENV !== "production") {
    res.locals.userId = "local-development";
    next();
    return;
  }

  const authorization = req.header("authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) {
    res.status(401).json({ error: "Sign in is required." });
    return;
  }

  const cached = userCache.get(token);
  if (cached && cached.expiresAt > Date.now()) {
    res.locals.userId = cached.id;
    next();
    return;
  }

  const config = supabaseConfig();
  if (!config) {
    res.status(503).json({ error: "Authentication is not configured on this server." });
    return;
  }

  try {
    const response = await fetch(`${config.url}/auth/v1/user`, {
      headers: {
        apikey: config.key,
        authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      res.status(401).json({ error: "Your session has expired. Please sign in again." });
      return;
    }
    const user = (await response.json()) as { id?: string };
    if (!user.id) {
      res.status(401).json({ error: "Your session is invalid. Please sign in again." });
      return;
    }
    userCache.set(token, { id: user.id, expiresAt: Date.now() + CACHE_TTL_MS });
    res.locals.userId = user.id;
    next();
  } catch {
    res.status(503).json({ error: "Authentication service is temporarily unavailable." });
  }
};

/** Small in-memory limit for the costly Gemini and image-processing endpoints. */
export function rateLimit(maxRequests: number, windowMs: number): RequestHandler {
  const requests = new Map<string, number[]>();
  return (req, res, next) => {
    const key = String(res.locals.userId ?? req.ip ?? "anonymous");
    const now = Date.now();
    const recent = (requests.get(key) ?? []).filter((time) => now - time < windowMs);
    if (recent.length >= maxRequests) {
      res.status(429).json({ error: "Too many AI requests. Please wait a few minutes and try again." });
      return;
    }
    recent.push(now);
    requests.set(key, recent);
    next();
  };
}
