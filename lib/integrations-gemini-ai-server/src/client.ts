// Image generation settings such as responseModalities are available on the
// Gemini v1beta endpoint. It also supports the text models we use elsewhere.
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

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
  },
): Promise<GeminiGenerateContentResponse> {
  const url = `${GEMINI_API_BASE}/models/${model}:generateContent?key=${getGeminiApiKey()}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      generationConfig: options?.generationConfig,
      ...(options?.systemInstruction
        ? { systemInstruction: { parts: [{ text: options.systemInstruction }] } }
        : {}),
    }),
  });

  const body = (await res.json()) as GeminiGenerateContentResponse & {
    error?: { message?: string };
  };

  if (!res.ok) {
    const message = body.error?.message ?? JSON.stringify(body);
    throw new Error(`Gemini API error ${res.status}: ${message}`);
  }

  return body;
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
