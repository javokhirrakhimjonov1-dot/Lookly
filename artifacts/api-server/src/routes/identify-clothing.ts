import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

const SYSTEM_PROMPT = `You are a fashion expert and textile analyst. Analyze the clothing item in the photo and return a JSON object with these exact fields:
- name: specific descriptive name (e.g. "White linen button-down shirt", "Navy blue slim-fit jeans", "Floral midi dress")
- category: exactly one of "tops", "bottoms", "dresses", "outerwear", "shoes", "accessories"
- colorName: the dominant color name, choose the closest from: Black, White, Beige, Navy, Camel, Burgundy, Olive, Gray, Blush, Denim, Terracotta, Cream. If none match, use the closest.
- colorHex: exact hex code matching colorName from this map — Black:#1C1512, White:#FAF8F5, Beige:#E8D5B7, Navy:#1E3A5F, Camel:#C19A6B, Burgundy:#800020, Olive:#6B7C4D, Gray:#8A8A8A, Blush:#E8A0A0, Denim:#5B7FA6, Terracotta:#C8906A, Cream:#FAF0E6
- material: fabric composition (e.g. "100% cotton", "80% polyester, 20% elastane", "genuine leather", "denim", "silk blend", "wool", "linen"). If not visible, make a reasonable guess based on the item's appearance.
- seasons: array of suitable seasons from ["spring", "summer", "fall", "winter"] (can include multiple)
- tags: array of 2–4 style descriptors (e.g. ["casual", "workwear", "minimal", "streetwear", "formal"])

Return ONLY valid JSON. No markdown fences, no explanation, no extra text.`;

router.post("/identify-clothing", async (req, res) => {
  const { image, mimeType = "image/jpeg" } = req.body as {
    image: string;
    mimeType?: string;
  };

  if (!image) {
    res.status(400).json({ error: "image is required (base64)" });
    return;
  }

  const response = await openai.chat.completions.create({
    model: "gpt-5.1",
    max_completion_tokens: 512,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${image}`,
              detail: "low",
            },
          },
          {
            type: "text",
            text: SYSTEM_PROMPT,
          },
        ],
      },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "";

  let parsed: {
    name: string;
    category: string;
    colorName: string;
    colorHex: string;
    material: string;
    seasons: string[];
    tags: string[];
  };

  try {
    parsed = JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
      res.status(422).json({ error: "Could not parse AI response", raw });
      return;
    }
    parsed = JSON.parse(match[0]);
  }

  res.json({
    name: parsed.name ?? "",
    category: parsed.category ?? "tops",
    colorName: parsed.colorName ?? "Black",
    colorHex: parsed.colorHex ?? "#1C1512",
    material: parsed.material ?? "Unknown",
    seasons: Array.isArray(parsed.seasons) ? parsed.seasons : [],
    tags: Array.isArray(parsed.tags) ? parsed.tags : [],
  });
});

export default router;
