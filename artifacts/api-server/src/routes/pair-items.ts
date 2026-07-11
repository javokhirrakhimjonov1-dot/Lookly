import { Router } from "express";
import { geminiChat } from "@workspace/integrations-gemini-ai-server";

const router = Router();

interface WardrobeItem {
  id: string;
  name: string;
  color: string;
  colorHex: string;
  category: string;
  seasons: string[];
  tags?: string[];
}

function weatherTierNote(temperature?: number): string {
  if (temperature === undefined) return "";
  if (temperature <= 0)  return "WEATHER: Freezing (≤0°C) — only suggest heavy coats, wool, and thermal layers. Sandals/light shoes are off-limits.";
  if (temperature <= 10) return "WEATHER: Cold (≤10°C) — outerwear is required. Prefer heavy or medium fabrics. No sleeveless tops.";
  if (temperature <= 17) return "WEATHER: Cool (≤17°C) — a light jacket or cardigan is recommended. Medium fabrics work well.";
  if (temperature <= 24) return "WEATHER: Mild (≤24°C) — comfortable without outerwear. Light to medium fabrics.";
  if (temperature <= 30) return "WEATHER: Hot (≤30°C) — avoid heavy fabrics and outerwear. Light, breathable items only.";
  return "WEATHER: Scorching (>30°C — Tashkent summer) — only light fabrics (linen, cotton). No coats or heavy layers. Sandals preferred.";
}

const BASE_SYSTEM_PROMPT = `You are an expert fashion stylist. Given a selected clothing item and a user's wardrobe, suggest the 2–3 best items from the wardrobe that pair well with it.

Rules:
- Only suggest items that actually exist in the provided wardrobe list (use their exact IDs).
- Do NOT suggest items of the same category as the selected item (e.g. don't pair a top with another top).
- Consider color harmony, occasion, season compatibility, AND current weather conditions.
- The WEATHER rule (if provided) is ABSOLUTE — never suggest a pairing that violates the temperature tier.
- Be specific and helpful in your reasoning — mention colors, style, or occasion.
- If a list of "already suggested" IDs is provided, suggest DIFFERENT items — explore new combinations.

Return ONLY a JSON array (no markdown, no explanation) with objects having these fields:
- id: the exact wardrobe item ID
- reason: 1–2 sentences explaining why this pairing works (mention specific colors, style, or weather suitability)
- vibe: one label from: "Perfect match" | "Bold contrast" | "Classic combo" | "Layer up" | "Color harmony" | "Casual cool"`;

router.post("/pair-items", async (req, res) => {
  const { selectedItem, wardrobe, excludeIds, weather, temperature } = req.body as {
    selectedItem: WardrobeItem;
    wardrobe: WardrobeItem[];
    excludeIds?: string[];
    weather?: string;
    temperature?: number;
  };

  if (!selectedItem || !Array.isArray(wardrobe)) {
    res.status(400).json({ error: "selectedItem and wardrobe are required" });
    return;
  }

  const excludeSet = new Set(excludeIds ?? []);

  const candidates = wardrobe.filter(
    (w) => w.id !== selectedItem.id && w.category !== selectedItem.category
  );

  if (candidates.length === 0) {
    res.json({ suggestions: [] });
    return;
  }

  const preferred = candidates.filter((w) => !excludeSet.has(w.id));
  const fallback = candidates.filter((w) => excludeSet.has(w.id));
  const pool = preferred.length >= 2 ? preferred : [...preferred, ...fallback];

  const wardrobeList = pool
    .map(
      (w) =>
        `ID: ${w.id} | ${w.name} (${w.category}, ${w.color}, seasons: ${w.seasons.join(", ")})`
    )
    .join("\n");

  const alreadySuggestedNote =
    excludeSet.size > 0
      ? `\nAlready suggested in a previous look (avoid repeating these): ${[...excludeSet].join(", ")}`
      : "";

  const weatherContext = weather && temperature !== undefined
    ? `\nCurrent weather in Tashkent: ${weather}, ${temperature}°C`
    : "";

  const userMessage = `Selected item: ${selectedItem.name} — ${selectedItem.category}, ${selectedItem.color} (${selectedItem.colorHex}), seasons: ${selectedItem.seasons.join(", ")}${alreadySuggestedNote}${weatherContext}

Wardrobe to choose from:
${wardrobeList}

Suggest 2–3 best matching items — make this combination feel fresh, different, and appropriate for today's weather.`;

  const tierNote = weatherTierNote(temperature);
  const systemPrompt = tierNote ? `${BASE_SYSTEM_PROMPT}\n\n${tierNote}` : BASE_SYSTEM_PROMPT;

  const raw = await geminiChat({
    system: systemPrompt,
    user: userMessage,
    maxOutputTokens: 512,
  }).catch(() => "");

  let parsed: { id: string; reason: string; vibe: string }[];
  try {
    const match = raw.match(/\[[\s\S]*\]/);
    parsed = JSON.parse(match ? match[0] : raw);
  } catch {
    parsed = [];
  }

  const validIds = new Set(candidates.map((c) => c.id));
  const filtered = parsed.filter((s) => validIds.has(s.id));

  res.json({ suggestions: filtered });
});

export default router;
