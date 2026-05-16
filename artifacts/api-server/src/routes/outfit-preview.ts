import { Router } from "express";
import { generateImageBuffer } from "@workspace/integrations-openai-ai-server/image";

const router = Router();

function buildOutfitPrompt(
  items: { name: string; color: string; category: string }[],
  weather: string,
  temperature: number
): string {
  const pieces = items
    .map((i) => `${i.color} ${i.name}`)
    .join(", ");

  const tempDesc =
    temperature >= 30
      ? "hot summer day"
      : temperature >= 20
      ? "warm pleasant day"
      : temperature >= 10
      ? "cool autumn day"
      : "cold winter day";

  return (
    `Fashion editorial portrait, full-body shot. A stylish young professional wearing: ${pieces}. ` +
    `${weather} weather, ${tempDesc}, ${temperature}°C in Tashkent. ` +
    `Clean minimal light studio background, soft natural lighting. ` +
    `High-end fashion magazine aesthetic, confident pose, looking at camera. ` +
    `Photorealistic, professional fashion photography.`
  );
}

router.post("/outfit-preview", async (req, res) => {
  const { items, weather, temperature } = req.body as {
    items: { name: string; color: string; colorHex: string; category: string }[];
    weather: string;
    temperature: number;
  };

  if (!items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "At least one item is required" });
    return;
  }

  const prompt = buildOutfitPrompt(items, weather ?? "Clear", temperature ?? 22);
  const buffer = await generateImageBuffer(prompt, "1024x1536");
  res.json({ image: buffer.toString("base64") });
});

export default router;
