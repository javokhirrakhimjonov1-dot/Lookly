import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

interface WardrobeItem {
  id: string;
  name: string;
  category: string;
  color: string;
  colorHex: string;
  seasons: string[];
  fabricWeight?: string;
  tags?: string[];
}

function weatherDesc(temp: number, code: number): string {
  if (code >= 71 && code <= 77) return "snowy";
  if (code >= 61 && code <= 67) return "rainy";
  if (code >= 51 && code <= 57) return "drizzly";
  if (code >= 2 && code <= 3) return "overcast";
  if (code === 1) return "mostly clear";
  if (code === 0) return "clear and sunny";
  return "variable";
}

const GENERIC_OUTFITS = [
  { name: "Effortless daytime", mood: "casual", items: [] as { itemId: string; role: string }[] },
  { name: "Polished minimalist", mood: "minimal", items: [] as { itemId: string; role: string }[] },
  { name: "Street casual", mood: "streetwear", items: [] as { itemId: string; role: string }[] },
];

router.post("/suggest-outfits", async (req, res) => {
  const {
    items,
    temperature,
    weatherCode,
  } = req.body as {
    items: WardrobeItem[];
    temperature: number;
    weatherCode: number;
  };

  if (!items || items.length < 2) {
    res.json({ outfits: GENERIC_OUTFITS });
    return;
  }

  const wDesc = weatherDesc(temperature, weatherCode);
  const needsOuterwear = temperature < 20 || (weatherCode >= 51 && weatherCode <= 82);

  const itemList = items
    .slice(0, 40)
    .map((i) => `${i.id}|${i.name}|${i.category}|${i.color}|${i.seasons.join(",")}`)
    .join("\n");

  const prompt = `You are a fashion stylist for a Tashkent-based wardrobe app.

Weather today in Tashkent: ${temperature}°C, ${wDesc}. Needs outerwear: ${needsOuterwear}.

Available wardrobe items (id|name|category|color|seasons):
${itemList}

Create exactly 3 to 5 distinct outfit combinations using ONLY the item IDs listed above.
Each outfit should suit today's weather and have a different vibe/mood from the others.

Return ONLY valid JSON with this exact structure:
{
  "outfits": [
    {
      "name": "Short evocative outfit name (2-4 words)",
      "mood": "one of: casual, minimal, streetwear, formal, sporty, boho, chic",
      "items": [
        { "itemId": "exact item id from list", "role": "top|bottom|outerwear|shoes|accessory|dress" }
      ]
    }
  ]
}

Rules:
- Use ONLY item IDs from the list — no made-up IDs
- Each outfit: 2 to 5 items. Include outerwear when weather requires it.
- Make outfits clearly distinct (different categories of items or different vibes)
- No explanation, no markdown — pure JSON only`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      max_completion_tokens: 800,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = response.choices[0]?.message?.content ?? "";

    let parsed: { outfits: { name: string; mood: string; items: { itemId: string; role: string }[] }[] };
    try {
      parsed = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) {
        res.json({ outfits: GENERIC_OUTFITS });
        return;
      }
      parsed = JSON.parse(match[0]);
    }

    const validIds = new Set(items.map((i) => i.id));
    const outfits = (parsed.outfits ?? []).map((o) => ({
      name: o.name ?? "Today's Look",
      mood: o.mood ?? "casual",
      items: (o.items ?? []).filter((x) => validIds.has(x.itemId)),
    })).filter((o) => o.items.length >= 1);

    res.json({ outfits: outfits.length > 0 ? outfits : GENERIC_OUTFITS });
  } catch {
    res.json({ outfits: GENERIC_OUTFITS });
  }
});

export default router;
