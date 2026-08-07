// Image generation settings such as responseModalities are available on the
// Gemini v1beta endpoint. It also supports the text models we use elsewhere.
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_REQUEST_TIMEOUT_MS = 120_000;
const DEFAULT_MAX_ATTEMPTS = 3;

class GeminiHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "GeminiHttpError";
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryAfterMs(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? undefined : Math.max(0, timestamp - Date.now());
}

function errorDescription(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const cause = error.cause as { code?: unknown; message?: unknown } | undefined;
  const causeCode = typeof cause?.code === "string" ? cause.code : "";
  const causeMessage = typeof cause?.message === "string" ? cause.message : "";
  const detail = [causeCode, causeMessage].filter(Boolean).join(": ");
  return detail ? `${error.message} (${detail})` : error.message;
}

function isRetryable(error: unknown): boolean {
  if (error instanceof GeminiHttpError) {
    return error.status === 429 || error.status >= 500;
  }
  if (!(error instanceof Error)) return false;
  const cause = error.cause as { code?: unknown } | undefined;
  const code = typeof cause?.code === "string" ? cause.code : "";
  return error.name === "AbortError"
    || error.name === "TimeoutError"
    || code === "EAI_AGAIN"
    || code === "ECONNRESET"
    || code === "ECONNREFUSED"
    || code === "ETIMEDOUT"
    || code === "ENETUNREACH"
    || code === "EHOSTUNREACH"
    || code.startsWith("UND_ERR_");
}

export function getGeminiApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error(
      "GEMINI_API_KEY must be set. Add it to artifacts/api-server/.env (see .env.example).",
    );
  }
  return key;
}

export function getGeminiTextModel(): string {
  return process.env.GEMINI_TEXT_MODEL ?? "gemini-2.5-flash";
}

export function getGeminiImageModel(): string {
  // Keep image generation separate from the analysis model. Gemini 3.1 Flash
  // Image is substantially more reliable at preserving garment references
  // and rendering a person consistently in a virtual try-on.
  return process.env.GEMINI_IMAGE_MODEL ?? "gemini-3.1-flash-image";
}

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

interface GeminiContent {
  parts: GeminiPart[];
  role?: string;
}

export interface GeminiGenerateContentResponse {
  candidates?: {
    content?: { parts?: GeminiPart[] };
  }[];
  error?: { message?: string };
}

export async function geminiGenerateContent(
  model: string,
  contents: GeminiContent[],
  options?: {
    generationConfig?: Record<string, unknown>;
    systemInstruction?: string;
    requestTimeoutMs?: number;
    maxAttempts?: number;
  },
): Promise<GeminiGenerateContentResponse> {
  const key = getGeminiApiKey();
  const url = new URL(`${GEMINI_API_BASE}/models/${model}:generateContent`);
  url.searchParams.set("key", key);
  const requestBody = JSON.stringify({
    contents,
    generationConfig: options?.generationConfig,
    ...(options?.systemInstruction
      ? { systemInstruction: { parts: [{ text: options.systemInstruction }] } }
      : {}),
  });
  const maxAttempts = Math.max(1, options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);
  const timeoutMs = Math.max(1_000, options?.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS);
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) break;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: requestBody,
        signal: AbortSignal.timeout(remainingMs),
      });
      const responseText = await res.text();
      let body: GeminiGenerateContentResponse & { error?: { message?: string } };
      try {
        body = responseText ? JSON.parse(responseText) : {};
      } catch {
        throw new GeminiHttpError(
          res.status,
          `Gemini API returned a non-JSON response (${res.status}).`,
          retryAfterMs(res.headers.get("retry-after")),
        );
      }

      if (!res.ok) {
        const message = body.error?.message ?? (responseText.slice(0, 500) || "Unknown Gemini API error");
        throw new GeminiHttpError(
          res.status,
          `Gemini API error ${res.status}: ${message}`,
          retryAfterMs(res.headers.get("retry-after")),
        );
      }
      return body;
    } catch (error: unknown) {
      lastError = error;
      if (attempt >= maxAttempts || !isRetryable(error)) break;
      const requestedDelay = error instanceof GeminiHttpError ? error.retryAfterMs : undefined;
      const backoffMs = requestedDelay ?? 400 * (2 ** (attempt - 1));
      if (Date.now() + backoffMs >= deadline) break;
      await delay(backoffMs);
    }
  }

  if (lastError instanceof GeminiHttpError) throw lastError;
  throw new Error(
    `Could not reach the Gemini API after ${maxAttempts} attempt${maxAttempts === 1 ? "" : "s"}: ${errorDescription(lastError)}`,
    { cause: lastError },
  );
}

export function extractTextFromResponse(response: GeminiGenerateContentResponse): string {
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  return parts
    .map((p) => p.text ?? "")
    .join("")
    .trim();
}

export function extractImageBase64FromResponse(
  response: GeminiGenerateContentResponse,
): string {
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    if (part.inlineData?.data) {
      return part.inlineData.data;
    }
  }
  throw new Error("Gemini returned no image data");
}
