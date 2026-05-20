import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import {
  generateImageBuffer,
  editImageFromBase64,
} from "@workspace/integrations-openai-ai-server/image";

const router = Router();

interface BrandLogo {
  brand: string;
  description: string;
  position: string;
  size: "small" | "medium" | "large";
}

type Item = {
  name: string;
  color: string;
  colorHex: string;
  category: string;
  brandLogo?: BrandLogo | null;
};

function clothingLines(items: Item[]): string {
  return items
    .map((i) => {
      const base = `  - ${i.color} ${i.name} (${i.category})`;
      if (i.brandLogo) {
        return (
          `${base}: plain solid ${i.color.toUpperCase()} fabric.` +
          ` HAS a ${i.brandLogo.size} ${i.brandLogo.description} (${i.brandLogo.brand}) at the ${i.brandLogo.position} —` +
          ` render this logo/mark faithfully at exactly that position and proportional scale. NO other logos, text, or graphics anywhere else.`
        );
      }
      return (
        `${base}: RENDER AS COMPLETELY PLAIN SOLID ${i.color.toUpperCase()} —` +
        ` ZERO logos, ZERO text, ZERO graphics, ZERO patterns, ZERO prints, ZERO decorations of any kind`
      );
    })
    .join("\n");
}

function buildEditPrompt(items: Item[], weather: string, temperature: number): string {
  const hasShoes = items.some((i) => i.category === "shoes");
  const tempDesc =
    temperature >= 30 ? "hot summer day"
    : temperature >= 20 ? "warm pleasant day"
    : temperature >= 10 ? "cool autumn day"
    : "cold winter day";

  const shoesRule = hasShoes
    ? `Keep the feet and shoes FULLY visible at the very bottom — do NOT crop at the ankles.`
    : `Show the complete figure from crown of head to tips of feet.`;

  return (
    `Fashion editorial photo. KEEP THIS EXACT PERSON — their face, skin tone, hair colour and style, body shape, and all physical features must remain IDENTICAL to the reference image. Change ONLY the clothing.\n\n` +
    `Dress them in EXACTLY these items:\n${clothingLines(items)}\n\n` +
    `ABSOLUTE RULES:\n` +
    `1. Every item must be PLAIN SOLID COLOR except where a logo is explicitly listed. ZERO logos, text, graphics, prints or patterns unless explicitly described.\n` +
    `2. Do NOT add any clothing, accessories, or props not listed above.\n` +
    `3. The person's face, hair, eye color, skin tone, and body are IDENTICAL to the reference photo — do NOT change them.\n` +
    `4. ${shoesRule}\n` +
    `5. Full-body PORTRAIT frame, complete body visible, no cropping.\n\n` +
    `Setting: ${weather} weather, ${tempDesc} (${temperature}°C), Tashkent. Clean minimal studio background, soft diffused lighting, confident natural standing pose.`
  );
}

function buildGeneratePrompt(
  items: Item[],
  weather: string,
  temperature: number,
  personDescription: string
): string {
  const hasShoes = items.some((i) => i.category === "shoes");
  const tempDesc =
    temperature >= 30 ? "hot summer day"
    : temperature >= 20 ? "warm pleasant day"
    : temperature >= 10 ? "cool autumn day"
    : "cold winter day";

  const shoesRule = hasShoes
    ? `6. SHOES ARE MANDATORY: feet and shoes MUST be fully visible at the very bottom of the frame. Do NOT cut off at the ankles. Show the complete body from crown of head to soles of shoes with a small strip of floor visible beneath.\n`
    : `6. Show the complete figure from head to toe. Feet must be visible at the bottom of the frame.\n`;

  return (
    `Fashion editorial FULL-BODY portrait photograph — PORTRAIT orientation.\n` +
    `CRITICAL COMPOSITION RULE: The entire body MUST be visible from the very top of the head to the tips of the feet/shoes. Frame the shot so the subject fills roughly 85% of the image height. DO NOT crop or cut off any body part.\n\n` +
    `Subject: ${personDescription}\n\n` +
    `This person is wearing EXACTLY the following items:\n${clothingLines(items)}\n\n` +
    `ABSOLUTE RULES:\n` +
    `1. Every clothing item must be PLAIN SOLID COLOR except where a logo is explicitly listed. ZERO logos, text, graphics, prints or patterns unless explicitly described.\n` +
    `2. A white t-shirt must be COMPLETELY PLAIN WHITE with NOTHING printed on it unless its logo is explicitly described.\n` +
    `3. Do NOT invent any design elements, textures, or details not described.\n` +
    `4. Render ONLY the items listed — do NOT add extra clothing, accessories, or props.\n` +
    `5. Keep the person's face, hair, and body exactly as described.\n` +
    shoesRule +
    `\nSetting: ${weather} weather, ${tempDesc} (${temperature}°C), Tashkent.\n` +
    `Style: Clean minimal studio background, soft diffused lighting. High-end fashion magazine aesthetic. Confident, natural standing pose. Camera angle: straight-on at chest height so the full body fits in frame.`
  );
}

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

router.post("/outfit-preview", async (req, res) => {
  const {
    items,
    weather,
    temperature,
    userBodyPhotoBase64,
    userBodyPhotoMime,
    userGender,
    userAge,
  } = req.body as {
    items: Item[];
    weather: string;
    temperature: number;
    userBodyPhotoBase64?: string;
    userBodyPhotoMime?: string;
    userGender?: string;
    userAge?: number;
  };

  if (!items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "At least one item is required" });
    return;
  }

  let buffer: Buffer;

  try {
    if (userBodyPhotoBase64) {
      const prompt = buildEditPrompt(items, weather ?? "Clear", temperature ?? 22);
      buffer = await editImageFromBase64(
        userBodyPhotoBase64,
        userBodyPhotoMime ?? "image/jpeg",
        prompt,
        "1024x1536"
      );
    } else {
      function buildFallbackDescription(): string {
        const genderLabel =
          userGender === "male" ? "man"
          : userGender === "female" ? "woman"
          : userGender === "non-binary" ? "non-binary person"
          : "person";
        const ageLabel = userAge ? ` in their ${Math.floor(userAge / 10) * 10}s` : "";
        return `a stylish ${genderLabel}${ageLabel} with a confident stance`;
      }

      let personDescription = buildFallbackDescription();
      try {
        personDescription = buildFallbackDescription();
      } catch {
        personDescription = buildFallbackDescription();
      }

      const prompt = buildGeneratePrompt(items, weather ?? "Clear", temperature ?? 22, personDescription);
      buffer = await generateImageBuffer(prompt, "1024x1536");
    }
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
