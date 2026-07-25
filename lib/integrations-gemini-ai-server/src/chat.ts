import {
  extractTextFromResponse,
  geminiGenerateContent,
  getGeminiTextModel,
} from "./client";

export async function geminiChatWithImage(options: {
  imageBase64: string;
  mimeType: string;
  text: string;
  maxOutputTokens?: number;
}): Promise<string> {
  const response = await geminiGenerateContent(
    // Gemini's normal Flash model accepts image input and returns the JSON
    // analysis we need here. The image-generation model is only for creating
    // pictures and can have a separate (or unavailable) generation quota.
    getGeminiTextModel(),
    [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: options.mimeType,
              data: options.imageBase64,
            },
          },
          { text: options.text },
        ],
      },
    ],
    {
      generationConfig: { maxOutputTokens: options.maxOutputTokens ?? 1024 },
    },
  );

  return extractTextFromResponse(response);
}

export async function geminiChat(options: {
  system?: string;
  user: string;
  temperature?: number;
  maxOutputTokens?: number;
}): Promise<string> {
  const parts: { text: string }[] = [];
  if (options.system) {
    parts.push({ text: `System: ${options.system}` });
  }
  parts.push({ text: options.user });

  const response = await geminiGenerateContent(
    getGeminiTextModel(),
    [{ role: "user", parts }],
    {
      generationConfig: {
        maxOutputTokens: options.maxOutputTokens ?? 1024,
        temperature: options.temperature ?? 0.7,
      },
    },
  );

  return extractTextFromResponse(response);
}
