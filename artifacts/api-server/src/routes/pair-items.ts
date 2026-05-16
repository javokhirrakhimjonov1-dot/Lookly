import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

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

const SYSTEM_PROMPT = `You are an expert fashion stylist. Given a selected clothing item and a user's wardrobe, suggest the 2–3 best items from the wardrobe that pair well with it.

Rules:
- Only suggest items that actually exist in the provided wardrobe list (use their exact IDs).
- Do NOT suggest items of the same category as the selected item (e.g. don't pair a top with another top).
- Consider color harmony, occasion, and season compatibility.
- Be specific and helpful in your reasoning — mention colors, style, or occasion.
- If a list of "already suggested" IDs is provided, suggest DIFFERENT items — explore new combinations.

Return ONLY a JSON array (no markdown, no explanation) with objects having these fields:
- id: the exact wardrobe item ID
- reason: 1–2 sentences explaining why this pairing works (mention specific colors or style)
- vibe: one label from: "Perfect match" | "Bold contrast" | "Classic combo" | "Layer up" | "Color harmony" | "Casual cool"`;

router.post("/pair-items", async (req, res) => {
  const { selectedItem, wardrobe, excludeIds } = req.body as {
    selectedItem: WardrobeItem;
    wardrobe: WardrobeItem[];
    excludeIds?: string[];
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

  const userMessage = `Selected item: ${selectedItem.name} — ${selectedItem.category}, ${selectedItem.color} (${selectedItem.colorHex}), seasons: ${selectedItem.seasons.join(", ")}${alreadySuggestedNote}

Wardrobe to choose from:
${wardrobeList}

Suggest 2–3 best matching items — make this combination feel fresh and different.`;

  const response = await openai.chat.completions.create({
    model: "gpt-5.1",
    max_completion_tokens: 512,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "[]";

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
