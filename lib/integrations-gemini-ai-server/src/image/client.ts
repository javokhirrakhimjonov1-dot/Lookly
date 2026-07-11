import { Buffer } from "node:buffer";
import {
  extractImageBase64FromResponse,
  geminiGenerateContent,
  getGeminiImageModel,
} from "../client";

const IMAGE_GENERATION_CONFIG = {
  responseModalities: ["TEXT", "IMAGE"],
};

function mapSizeToAspectRatio(
  size: "1024x1024" | "1024x1536" | "1536x1024",
): string {
  if (size === "1024x1536") return "3:4";
  if (size === "1536x1024") return "4:3";
  return "1:1";
}

export async function generateImageBuffer(
  prompt: string,
  size: "1024x1024" | "1024x1536" | "1536x1024" = "1024x1024",
): Promise<Buffer> {
  const response = await geminiGenerateContent(
    getGeminiImageModel(),
    [{ role: "user", parts: [{ text: prompt }] }],
    {
      generationConfig: {
        ...IMAGE_GENERATION_CONFIG,
        imageConfig: { aspectRatio: mapSizeToAspectRatio(size) },
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
  size: "1024x1024" | "1024x1536" | "1536x1024" = "1024x1536",
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
        imageConfig: { aspectRatio: mapSizeToAspectRatio(size) },
      },
    },
  );

  const base64 = extractImageBase64FromResponse(response);
  return Buffer.from(base64, "base64");
}
