import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { generateImageBuffer } from "@workspace/integrations-openai-ai-server/image";

const router = Router();

async function describePersonFromPhoto(base64: string, mime: string): Promise<string> {
  const res = await openai.chat.completions.create({
    model: "gpt-5.1",
    max_completion_tokens: 80,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: `data:${mime};base64,${base64}`, detail: "low" },
          },
          {
            type: "text",
            text: `Describe this person's appearance for a fashion image. Include: skin tone, hair color and length, body build, approximate age range, and gender presentation. Be concise (1-2 sentences). Example: "A woman in her late 20s with medium-brown skin, long dark wavy hair, and a slim athletic build." Do not include names or identifiable information.`,
          },
        ],
      },
    ],
  });
  return res.choices[0]?.message?.content?.trim() ?? "a stylish young adult";
}

function buildPrompt(
  items: { name: string; color: string; category: string }[],
  weather: string,
  temperature: number,
  personDescription: string
): string {
  const pieces = items
    .map(
      (i) =>
        `  - ${i.color} ${i.name} (${i.category}): RENDER AS COMPLETELY PLAIN SOLID ${i.color.toUpperCase()} — ZERO logos, ZERO text, ZERO graphics, ZERO patterns, ZERO prints, ZERO decorations of any kind`
    )
    .join("\n");

  const tempDesc =
    temperature >= 30
      ? "hot summer day"
      : temperature >= 20
      ? "warm pleasant day"
      : temperature >= 10
      ? "cool autumn day"
      : "cold winter day";

  return (
    `Fashion editorial full-body portrait photograph.\n` +
    `Subject: ${personDescription}\n\n` +
    `This person is wearing EXACTLY the following items — render each item faithfully:\n` +
    `${pieces}\n\n` +
    `ABSOLUTE RULES — violating any of these is unacceptable:\n` +
    `1. Every clothing item must be PLAIN SOLID COLOR. NO logos, NO brand marks, NO text, NO graphics, NO prints, NO patterns, NO embroidery, NO badges, NO buttons, NO stripes unless explicitly described above.\n` +
    `2. A white t-shirt must be COMPLETELY PLAIN WHITE with NOTHING printed on it.\n` +
    `3. Do NOT invent any design elements, textures, or details not described above.\n` +
    `4. Render ONLY the items listed — do NOT add extra clothing, accessories, or props.\n` +
    `5. Keep the person's face, hair, and body exactly as described.\n\n` +
    `Setting: ${weather} weather, ${tempDesc} (${temperature}°C), Tashkent.\n` +
    `Style: Clean minimal studio background, soft diffused lighting. High-end fashion magazine aesthetic. Confident, natural pose.`
  );
}

router.post("/outfit-preview", async (req, res) => {
  const {
    items,
    weather,
    temperature,
    userBodyPhotoBase64,
    userBodyPhotoMime,
  } = req.body as {
    items: { name: string; color: string; colorHex: string; category: string }[];
    weather: string;
    temperature: number;
    userBodyPhotoBase64?: string;
    userBodyPhotoMime?: string;
  };

  if (!items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "At least one item is required" });
    return;
  }

  let personDescription = "a stylish young adult with a confident stance";

  if (userBodyPhotoBase64) {
    try {
      personDescription = await describePersonFromPhoto(
        userBodyPhotoBase64,
        userBodyPhotoMime ?? "image/jpeg"
      );
    } catch {
      personDescription = "a stylish young adult with a confident stance";
    }
  }

  const prompt = buildPrompt(items, weather ?? "Clear", temperature ?? 22, personDescription);

  let buffer: Buffer;
  try {
    buffer = await generateImageBuffer(prompt, "1024x1536");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const isQuota =
      msg.toLowerCase().includes("quota") ||
      msg.toLowerCase().includes("rate limit") ||
      msg.toLowerCase().includes("exceeded") ||
      msg.toLowerCase().includes("429");
    const status = isQuota ? 429 : 500;
    const userMessage = isQuota
      ? "Daily image generation limit reached. Please try again in a few hours."
      : "Image generation failed. Please try again.";
    res.status(status).json({ error: userMessage });
    return;
  }

  res.json({ image: buffer.toString("base64") });
});

export default router;
