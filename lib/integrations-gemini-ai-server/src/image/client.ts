import { Buffer } from "node:buffer";
import {
  extractImageBase64FromResponse,
  geminiGenerateContent,
  getGeminiImageModel,
} from "../client";

// The server uses Gemini's `generateContent` endpoint. Its supported image
// configuration is response modalities; `responseFormat` belongs to the newer
// Interactions API and caused image calls to be rejected before generation.
const IMAGE_GENERATION_CONFIG = {
  responseModalities: ["TEXT", "IMAGE"],
};

export async function generateImageBuffer(
  prompt: string,
  _size: "1024x1024" | "1024x1536" | "1536x1024" = "1024x1024",
): Promise<Buffer> {
  const response = await geminiGenerateContent(
    getGeminiImageModel(),
    [{ role: "user", parts: [{ text: prompt }] }],
    {
      generationConfig: {
        ...IMAGE_GENERATION_CONFIG,
      },
    },
  );

  const base64 = extractImageBase64FromResponse(response);
  return Buffer.from(base64, "base64");
}

export async function editImageFromBase64(
  imageBase64: string,
  imageMime: string,
  prompt: string,
  _size: "1024x1024" | "1024x1536" | "1536x1024" = "1024x1536",
): Promise<Buffer> {
  const response = await geminiGenerateContent(
    getGeminiImageModel(),
    [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: imageMime, data: imageBase64 } },
          { text: prompt },
        ],
      },
    ],
    {
      generationConfig: {
        ...IMAGE_GENERATION_CONFIG,
      },
    },
  );

  const base64 = extractImageBase64FromResponse(response);
  return Buffer.from(base64, "base64");
}

/**
 * Generates one image from several visual references.  This is used for
 * virtual try-on: the body reference (when supplied) and each wardrobe item
 * are passed to the model together, instead of asking it to guess garments
 * from their names alone.
 */
export async function generateImageFromReferences(
  references: Array<{ imageBase64: string; imageMime: string }>,
  prompt: string,
  _size: "1024x1024" | "1024x1536" | "1536x1024" = "1024x1536",
): Promise<Buffer> {
  const parts = [
    ...references.map((reference) => ({
      inlineData: { mimeType: reference.imageMime, data: reference.imageBase64 },
    })),
    { text: prompt },
  ];
  const response = await geminiGenerateContent(
    getGeminiImageModel(),
    [{ role: "user", parts }],
    {
      generationConfig: {
        ...IMAGE_GENERATION_CONFIG,
      },
    },
  );

  const base64 = extractImageBase64FromResponse(response);
  return Buffer.from(base64, "base64");
}
