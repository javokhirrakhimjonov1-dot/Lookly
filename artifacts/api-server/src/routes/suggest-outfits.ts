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

function weatherTierInstructions(temp: number, code: number): string {
  const isRain = code >= 51 && code <= 82;
  const isSnow = code >= 71 && code <= 77;

  if (isSnow || temp <= 0) return (
    `FREEZING (${temp}°C). MANDATORY: heavy outerwear (coat/puffer) is REQUIRED in every outfit. ` +
    `ONLY use heavy or medium fabric items. NEVER suggest light fabrics or shorts. ` +
    `Prioritise warmth — layer tops, use boots, avoid exposed skin.`
  );
  if (temp <= 10) return (
    `COLD (${temp}°C). Outerwear (jacket/coat) is REQUIRED in every outfit. ` +
    `Prefer heavy or medium fabrics. Avoid light fabrics and bare legs. ` +
    `Closed shoes preferred.`
  );
  if (temp <= 17) return (
    `COOL (${temp}°C). A light jacket, blazer, or cardigan should be included where available. ` +
    `Medium fabrics work well. Avoid very heavy coats — they are too warm. ` +
    isRain ? "Rain expected — include waterproof or water-resistant outerwear if available." : ""
  );
  if (temp <= 24) return (
    `MILD / WARM (${temp}°C). No outerwear needed unless it's raining. ` +
    `Light to medium fabrics are ideal. Jeans, chinos, midi skirts all work. ` +
    isRain ? "Rain expected — suggest a light raincoat or water-resistant layer if available." : ""
  );
  if (temp <= 30) return (
    `HOT (${temp}°C). NEVER include heavy coats, puffers, or heavy-fabric outerwear. ` +
    `STRONGLY prefer light-fabric items (linen, cotton, etc.). Shorts, light trousers, and breathable tops. ` +
    `Minimal layering. Sandals or light shoes preferred.`
  );
  return (
    `VERY HOT / SCORCHING (${temp}°C — Tashkent summer heat). ` +
    `ONLY light-fabric items are acceptable — linen, cotton, breathable synthetics. ` +
    `NEVER suggest outerwear, heavy fabrics, or anything that traps heat. ` +
    `Maximise breathability: loose fits, open weaves, sandals. Keep it minimal.`
  );
}

const GENERIC_OUTFITS = [
  { name: "Effortless daytime", mood: "casual", weatherNote: "General everyday look", items: [] as { itemId: string; role: string }[] },
  { name: "Polished minimalist", mood: "minimal", weatherNote: "Clean, simple fit", items: [] as { itemId: string; role: string }[] },
  { name: "Street casual", mood: "streetwear", weatherNote: "Casual street style", items: [] as { itemId: string; role: string }[] },
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
  const tierInstructions = weatherTierInstructions(temperature, weatherCode);

  const itemList = items
    .slice(0, 40)
    .map((i) => `${i.id}|${i.name}|${i.category}|${i.color}|${i.fabricWeight ?? "medium"}|${i.seasons.join(",")}`)
    .join("\n");

  const MOODS = ["casual", "minimal", "streetwear", "formal", "sporty", "boho", "chic"];
  const shuffledMoods = [...MOODS].sort(() => Math.random() - 0.5).slice(0, 4);
  const variationSeed = Math.floor(Math.random() * 10000);
  const STYLE_DIRECTIVES = [
    "Lean into bold colour contrasts this round.",
    "Focus on monochrome or tonal dressing this time.",
    "Mix textures — pair lightweight with structured pieces.",
    "Go for the most unexpected combinations that still work.",
    "Prioritise comfort-first looks with a polished finish.",
    "Think editorial — what would look good in a magazine spread?",
    "Emphasise layering and dimension.",
    "Go minimal: fewer pieces, maximum impact.",
  ];
  const styleDirective = STYLE_DIRECTIVES[variationSeed % STYLE_DIRECTIVES.length];

  const prompt = `You are a fashion stylist for a Tashkent-based wardrobe app. Variation seed: ${variationSeed}.

CURRENT WEATHER IN TASHKENT: ${temperature}°C, ${wDesc}.
WEATHER RULE FOR TODAY: ${tierInstructions}

Available wardrobe items (id|name|category|color|fabricWeight|seasons):
${itemList}

Create exactly 3 to 5 FRESH, UNIQUE outfit combinations using ONLY the item IDs listed above.
Each outfit MUST strictly follow the weather rule above — this is the top priority.
Style directive for this session: ${styleDirective}
Prioritise these moods (but use your judgment): ${shuffledMoods.join(", ")}.

CRITICAL: Generate genuinely different outfit combinations every time. Mix items in new ways.
Do not default to the same "safe" combinations — explore what the wardrobe can do.

Return ONLY valid JSON with this exact structure:
{
  "outfits": [
    {
      "name": "Short evocative outfit name (2-4 words)",
      "mood": "one of: casual, minimal, streetwear, formal, sporty, boho, chic",
      "weatherNote": "One short sentence explaining why this outfit suits today's weather (e.g. 'Light linen keeps you cool in the 31°C heat')",
      "items": [
        { "itemId": "exact item id from list", "role": "top|bottom|outerwear|shoes|accessory|dress" }
      ]
    }
  ]
}

Rules:
- Use ONLY item IDs from the list — no made-up IDs
- Each outfit: 2 to 5 items
- WEATHER RULES ARE ABSOLUTE — ignore them and the outfit is wrong
- Prefer items whose fabricWeight matches the temperature tier (light for hot, heavy for cold)
- Make outfits clearly distinct (different categories of items or different vibes)
- No explanation, no markdown — pure JSON only`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      max_completion_tokens: 800,
      temperature: 1.2,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = response.choices[0]?.message?.content ?? "";

    let parsed: { outfits: { name: string; mood: string; weatherNote?: string; items: { itemId: string; role: string }[] }[] };
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
      weatherNote: o.weatherNote ?? null,
      items: (o.items ?? []).filter((x) => validIds.has(x.itemId)),
    })).filter((o) => o.items.length >= 1);

    res.json({ outfits: outfits.length > 0 ? outfits : GENERIC_OUTFITS });
  } catch {
    res.json({ outfits: GENERIC_OUTFITS });
  }
});

export default router;
