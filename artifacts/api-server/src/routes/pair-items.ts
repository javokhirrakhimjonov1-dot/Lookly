import { Router } from "express";
import { geminiChat } from "@workspace/integrations-gemini-ai-server";
import { mapWardrobeItem, type StoredWardrobeItem } from "../data/wardrobeMap";
import { getModestyIssue, isAutomaticItemEligible, isHijabItem } from "../engine/modestyRules";
import type { UserProfile } from "../engine/weatherEngine";

const router = Router();

interface WardrobeItem {
  id: string;
  name: string;
  color: string;
  colorHex: string;
  category: string;
  seasons: string[];
  tags?: string[];
  fabricWeight?: "light" | "medium" | "heavy";
  visualSignature?: { garmentFamily?: string; itemType?: string; silhouette?: string; shape?: string; length?: string; sleeve?: string; neckline?: string; coverage?: string; opacity?: string; toeStyle?: string; heelType?: string; heelHeight?: string };
}

interface StylingPreferences { coverage?: "no_preference" | "modest" | "maximum_coverage"; silhouette?: "balanced" | "fitted" | "relaxed"; heels?: "flats" | "low_heels" | "any"; hijabPreference?: "always" | "no" | null; }

function categoriesCanPair(selected: WardrobeItem, candidate: WardrobeItem): boolean {
  if (selected.category === candidate.category) return false;
  if (selected.category === "dresses" && ["tops", "bottoms", "dresses"].includes(candidate.category)) return false;
  if (candidate.category === "dresses" && ["tops", "bottoms"].includes(selected.category)) return false;
  return true;
}

function weatherSafe(item: WardrobeItem, temperature?: number, weather?: string, preferences?: StylingPreferences): boolean {
  const text = `${item.name} ${(item.tags ?? []).join(" ")} ${item.visualSignature?.garmentFamily ?? ""}`.toLowerCase();
  const openToe = item.visualSignature?.toeStyle === "open" || /sandal|slide|flip.?flop|open.?toe/.test(text);
  const highHeel = item.visualSignature?.heelHeight === "high" || item.visualSignature?.heelType === "stiletto";
  const wet = /rain|snow|storm|drizzle/i.test(weather ?? "");
  if ((wet || (temperature !== undefined && temperature < 22)) && openToe) return false;
  if (wet && highHeel) return false;
  if (temperature !== undefined && temperature <= 10 && item.fabricWeight === "light" && ["tops","bottoms","dresses","outerwear"].includes(item.category)) return false;
  if (temperature !== undefined && temperature > 30 && (item.fabricWeight === "heavy" || item.category === "outerwear")) return false;
  if (preferences?.heels === "flats" && highHeel) return false;
  if (preferences?.heels === "low_heels" && item.visualSignature?.heelHeight === "high") return false;
  return true;
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
  const { selectedItem, wardrobe, excludeIds, weather, temperature, userGender, userAge, stylingPreferences } = req.body as {
    selectedItem: WardrobeItem;
    wardrobe: WardrobeItem[];
    excludeIds?: string[];
    weather?: string;
    temperature?: number;
    userGender?: string;
    userAge?: number;
    stylingPreferences?: StylingPreferences;
  };

  if (!selectedItem || !Array.isArray(wardrobe)) {
    res.status(400).json({ error: "selectedItem and wardrobe are required" });
    return;
  }
  if (userAge !== undefined && (!Number.isInteger(userAge) || userAge < 12 || userAge > 50)) {
    res.status(400).json({ error: "userAge must be a whole number from 12 to 50", code: "INVALID_AGE" });
    return;
  }

  const excludeSet = new Set(excludeIds ?? []);
  const effectiveStylingPreferences = userGender === "female" ? stylingPreferences : undefined;
  const profile: UserProfile = { gender:userGender, stylePreferences:["casual"], stylingPreferences:effectiveStylingPreferences };
  const toEngineItem = (item: WardrobeItem) => mapWardrobeItem(item as StoredWardrobeItem);
  const selectedEngineItem = toEngineItem(selectedItem);
  if (selectedEngineItem && getModestyIssue(selectedEngineItem, profile)) {
    res.json({ suggestions: [], incomplete:true, message:"This item does not match your current coverage settings.", reasonCodes:[getModestyIssue(selectedEngineItem, profile)] });
    return;
  }

  const mappedWardrobe = wardrobe.flatMap((item) => {
    const mapped = toEngineItem(item);
    return mapped ? [{ source:item, mapped }] : [];
  });
  const hijabCandidate = mappedWardrobe.find(({ mapped }) => isHijabItem(mapped));
  if (effectiveStylingPreferences?.hijabPreference === "always" && !hijabCandidate) {
    res.json({ suggestions: [], incomplete:true, message:"Add or identify a hijab in your wardrobe to complete this look.", reasonCodes:["HIJAB_REQUIRED"] });
    return;
  }

  const candidates = wardrobe.filter(
    (w) => {
      const mapped = toEngineItem(w);
      return w.id !== selectedItem.id && categoriesCanPair(selectedItem, w) && weatherSafe(w, temperature, weather, effectiveStylingPreferences)
        && Boolean(mapped && isAutomaticItemEligible(mapped, profile));
    }
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
Styling preferences: ${JSON.stringify(effectiveStylingPreferences ?? {})}

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
  let filtered = parsed.filter((s) => validIds.has(s.id));
  if (effectiveStylingPreferences?.hijabPreference === "always" && hijabCandidate && selectedItem.id !== hijabCandidate.source.id && !filtered.some((entry) => entry.id === hijabCandidate.source.id)) {
    filtered = [{ id:hijabCandidate.source.id, reason:"Your saved hijab completes this look and matches your profile coverage preference.", vibe:"Perfect match" }, ...filtered].slice(0, 3);
  }

  res.json({ suggestions: filtered.map((suggestion) => ({ ...suggestion, reasonCodes: ["WEATHER_SAFE", "CATEGORY_COMPATIBLE", ...(effectiveStylingPreferences?.hijabPreference === "always" ? ["HIJAB_REQUIRED", "MODEST_COVERAGE_REQUIRED"] : [])] })) });
});

export default router;
