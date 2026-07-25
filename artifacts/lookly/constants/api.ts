/** API base URL for Lookly backend (Gemini routes on api-server). */
const DEFAULT_LOCAL_API = "http://localhost:5000/api";

function isLocalHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function isExpoDevPort(port: string): boolean {
  return port === "8081" || port === "19006" || port === "19000";
}

/** Local API always runs on 5000 unless the page is already served from there. */
function needsLocalApiPort(hostname: string, port: string): boolean {
  if (!isLocalHost(hostname)) return false;
  // Expo may choose another available local port (for example 8082) when its
  // usual development port is occupied. Every localhost web port except the
  // API's own port must still call the API on 5000.
  return port !== "5000";
}

export function getApiBase(): string {
  const explicit = process.env.EXPO_PUBLIC_API_URL;
  if (explicit) {
    return explicit.replace(/\/$/, "");
  }

  if (typeof window !== "undefined" && window.location) {
    const { hostname, origin, port } = window.location;
    if (needsLocalApiPort(hostname, port)) {
      return `http://${hostname}:5000/api`;
    }
    return `${origin.replace(/\/$/, "")}/api`;
  }

  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) {
    const host = domain.replace(/^https?:\/\//, "");
    const isLocal = isLocalHost(host.split(":")[0] ?? host);
    const protocol = isLocal ? "http" : "https";
    const withPort =
      isLocal && !host.includes(":") ? `${host}:5000` : host;
    return `${protocol}://${withPort}/api`;
  }

  return DEFAULT_LOCAL_API;
}
