import { Router } from "express";

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

interface OutfitEntry {
  name: string;
  mood: string;
  weatherNote: string | null;
  items: { itemId: string; role: string }[];
}

const MOODS = ["casual", "minimal", "streetwear", "formal", "sporty", "boho", "chic"];

function isNeutralColor(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? true : (max - min) / max < 0.22;
}

function getColorGroup(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const max = Math.max(r, g, b);
  if (max === 0) return "dark";
  if ((max - Math.min(r, g, b)) / max < 0.22) return "neutral";
  if (r === max && g < 120 && b < 120) return "warm";
  if (b === max && r < 120 && g < 120) return "cool";
  if (g === max && r < 120 && b < 120) return "fresh";
  if (r > 140 && g > 140 && b < 100) return "bright";
  return "mixed";
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickRandom<T>(arr: T[]): T | null {
  if (arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function getCurrentSeason(): string {
  const m = new Date().getMonth();
  if (m >= 2 && m <= 4) return "spring";
  if (m >= 5 && m <= 7) return "summer";
  // The mobile app stores this season as "fall".
  if (m >= 8 && m <= 10) return "fall";
  return "winter";
}

function describeWeather(temp: number, code: number): string {
  if (code >= 71 && code <= 77) return "snowy";
  if (code >= 61 && code <= 67) return "rainy";
  if (code >= 51 && code <= 57) return "drizzly";
  if (code >= 2 && code <= 3) return "overcast";
  if (code === 1) return "mostly clear";
  if (code === 0) return "clear and sunny";
  return "variable";
}

function getWeatherTier(temp: number, code: number): string {
  const isSnow = code >= 71 && code <= 77;
  if (isSnow || temp <= 0) return "freezing";
  if (temp <= 10) return "cold";
  if (temp <= 17) return "cool";
  if (temp <= 24) return "mild";
  if (temp <= 30) return "hot";
  return "scorching";
}

function isHeavyOuterwearRequired(temp: number): boolean {
  return temp <= 0;
}

function isOuterwearRequired(temp: number): boolean {
  return temp <= 10;
}

function isLightOuterwearNice(temp: number): boolean {
  return temp <= 17;
}

function isHeavyFabricBanned(temp: number): boolean {
  return temp > 24;
}

function isHot(temp: number): boolean {
  return temp > 24;
}

function isCold(temp: number): boolean {
  return temp < 12;
}

function isSummerOnlyShoe(item: WardrobeItem): boolean {
  const name = item.name.toLowerCase();
  const cat = item.category.toLowerCase();
  if (cat !== "shoes") return false;
  return (
    name.includes("sandal") ||
    name.includes("slide") ||
    name.includes("flip") ||
    name.includes("open") ||
    name.includes("mule")
  );
}

function filterByWeather(items: WardrobeItem[], temperature: number): WardrobeItem[] {
  return items.filter((i) => {
    if (isHot(temperature) && i.fabricWeight === "heavy") return false;
    if (isCold(temperature) && i.fabricWeight === "light") return false;
    if (isCold(temperature) && isSummerOnlyShoe(i)) return false;
    return true;
  });
}

function getCategoryPool(items: WardrobeItem[], category: string): WardrobeItem[] {
  const cat = items.filter((i) => i.category.toLowerCase() === category.toLowerCase());
  const season = getCurrentSeason();
  const seasonPool = cat.filter((i) => i.seasons.includes(season));
  return seasonPool.length > 0 ? seasonPool : cat;
}

function pickItem(
  pool: WardrobeItem[],
  usedIds: Set<string>,
  preferColor?: string,
  avoidColor?: string
): WardrobeItem | null {
  let candidates = pool.filter((i) => !usedIds.has(i.id));
  if (candidates.length === 0) {
    candidates = pool;
  }
  if (candidates.length === 0) return null;

  if (preferColor) {
    const colored = candidates.filter((i) => getColorGroup(i.colorHex) === preferColor);
    if (colored.length > 0) return pickRandom(colored)!;
  }

  if (avoidColor) {
    const filtered = candidates.filter((i) => getColorGroup(i.colorHex) !== avoidColor);
    if (filtered.length > 0) candidates = filtered;
  }

  return pickRandom(candidates);
}

function generateOutfitName(mood: string, items: WardrobeItem[]): string {
  const names: Record<string, string[]> = {
    casual: ["Effortless Day", "Casual Comfort", "Everyday Cool", "Relaxed Fit", "Easy Going"],
    minimal: ["Clean Minimal", "Quiet Elegance", "Subtle Edge", "Pure Form", "Soft Minimal"],
    streetwear: ["Urban Edge", "Street Vibe", "City Flow", "Bold Layer", "Cruise Control"],
    formal: ["Polished Look", "Refined Edge", "Tailored Fit", "Classic Form", "Sharp Dressed"],
    sporty: ["Active Pulse", "Sport Mode", "Energy Fit", "Fresh Move", "On The Go"],
    boho: ["Free Spirit", "Earthy Flow", "Wanderlust", "Natural Vibe", "Desert Rose"],
    chic: ["Chic Statement", "Parisian Cool", "Effortless Chic", "Modern Glow", "Style Edit"],
  };
  const pool = names[mood] ?? names.casual;
  return pickRandom(pool) ?? "Today's Look";
}

function generateWeatherNote(temperature: number, mood: string): string {
  const tier = getWeatherTier(temperature, 0);
  const notes: Record<string, string[]> = {
    freezing: ["Bundled up but still stylish for the cold", "Heavy layers keep you warm in the freeze"],
    cold: ["Warm layers with a smart finish for the chill", "Cozy and polished despite the cold"],
    cool: ["Light layers for the cool breeze", "Comfortable coverage for a crisp day"],
    mild: ["Perfect balance of style and comfort", "Ideal for the mild weather"],
    hot: ["Light and breathable for the heat", "Staying cool while looking sharp"],
    scorching: ["Maximum breathability in the scorching heat", "Keeps you cool when it really counts"],
  };
  const pool = notes[tier] ?? notes.mild;
  return pickRandom(pool) ?? "Designed for today's weather";
}

function assignMood(
  items: WardrobeItem[],
  preferredMoods: string[],
  usedMoods: Set<string>
): string {
  const hasNeutral = items.some((i) => isNeutralColor(i.colorHex));
  const hasWarm = items.some((i) => getColorGroup(i.colorHex) === "warm");
  const hasCool = items.some((i) => getColorGroup(i.colorHex) === "cool");
  const hasBold = items.some((i) => getColorGroup(i.colorHex) === "bright" || getColorGroup(i.colorHex) === "warm");

  for (const m of preferredMoods) {
    if (!usedMoods.has(m)) return m;
  }

  if (hasBold && !usedMoods.has("streetwear")) return "streetwear";
  if (hasNeutral && !usedMoods.has("minimal")) return "minimal";
  if (hasCool && !usedMoods.has("chic")) return "chic";
  if (hasWarm && !usedMoods.has("boho")) return "boho";

  const available = preferredMoods[preferredMoods.length - 1];
  return available;
}

function generateOutfitsLocally(
  items: WardrobeItem[],
  temperature: number
): OutfitEntry[] {
  const weatherFiltered = filterByWeather(items, temperature);
  const season = getCurrentSeason();

  // Build category pools
  // These must match ClothingCategory in the mobile app exactly.
  const tops = getCategoryPool(weatherFiltered, "tops");
  const bottoms = getCategoryPool(weatherFiltered, "bottoms");
  const outerwear = getCategoryPool(weatherFiltered, "outerwear");
  const dresses = getCategoryPool(weatherFiltered, "dresses");
  const shoes = getCategoryPool(weatherFiltered, "shoes");
  const accessories = getCategoryPool(weatherFiltered, "accessories");

  const isHotWeather = isHot(temperature);
  const isColdWeather = isCold(temperature);
  const needsOuterwear = isOuterwearRequired(temperature);
  const needsHeavyOuterwear = isHeavyOuterwearRequired(temperature);

  const usedIds = new Set<string>();
  const usedMoods = new Set<string>();
  const outfits: OutfitEntry[] = [];

  const numOutfits = Math.min(5, Math.max(3, Math.floor(items.length / 3)));

  // Build preferred mood pool based on available items
  const moodPool: string[] = [];
  const hasDress = dresses.length > 0;
  const hasOuterwear = outerwear.length > 0;
  const hasAccessories = accessories.length > 0;
  const neutralCount = items.filter((i) => isNeutralColor(i.colorHex)).length;
  const warmCount = items.filter((i) => getColorGroup(i.colorHex) === "warm").length;
  const coolCount = items.filter((i) => getColorGroup(i.colorHex) === "cool").length;

  if (hasDress) moodPool.push("chic", "minimal", "casual", "boho");
  if (hasOuterwear) moodPool.push("streetwear", "formal", "casual");
  if (neutralCount > warmCount + coolCount) moodPool.push("minimal", "formal");
  if (warmCount > coolCount) moodPool.push("boho", "casual");
  if (coolCount > warmCount) moodPool.push("chic", "minimal");
  moodPool.push(...MOODS);

  const uniqueMoods = [...new Set(moodPool)];

  for (let o = 0; o < numOutfits; o++) {
    const outfitItems: { itemId: string; role: string }[] = [];
    const selected: WardrobeItem[] = [];

    // Determine if this outfit uses a dress (if available)
    const useDress = hasDress && o % 2 === 0 && o < dresses.length * 2;

    if (useDress) {
      const dress = pickItem(dresses, usedIds);
      if (dress) {
        usedIds.add(dress.id);
        outfitItems.push({ itemId: dress.id, role: "dress" });
        selected.push(dress);
      }
    } else {
      // Pick top
      if (tops.length > 0) {
        const top = pickItem(tops, usedIds);
        if (top) {
          usedIds.add(top.id);
          outfitItems.push({ itemId: top.id, role: "top" });
          selected.push(top);
        }
      }

      // Pick bottom
      if (bottoms.length > 0) {
        const topColor = selected.length > 0 ? getColorGroup(selected[0].colorHex) : undefined;
        const bottom = pickItem(bottoms, usedIds, "neutral", topColor === "neutral" ? undefined : topColor);
        if (bottom) {
          usedIds.add(bottom.id);
          outfitItems.push({ itemId: bottom.id, role: "bottom" });
          selected.push(bottom);
        }
      }
    }

    // Pick outerwear if weather requires or available
    if (outerwear.length > 0 && (needsOuterwear || (!isHotWeather && Math.random() < 0.4))) {
      const ow = pickItem(outerwear, usedIds);
      if (ow) {
        usedIds.add(ow.id);
        outfitItems.push({ itemId: ow.id, role: "outerwear" });
        selected.push(ow);
      }
    }

    // Pick shoes
    if (shoes.length > 0) {
      const shoe = pickItem(shoes, usedIds);
      if (shoe) {
        usedIds.add(shoe.id);
        outfitItems.push({ itemId: shoe.id, role: "shoes" });
        selected.push(shoe);
      }
    }

    // Pick accessory
    if (accessories.length > 0 && Math.random() < 0.5) {
      const acc = pickItem(accessories, usedIds);
      if (acc) {
        usedIds.add(acc.id);
        outfitItems.push({ itemId: acc.id, role: "accessory" });
        selected.push(acc);
      }
    }

    if (outfitItems.length < 2) {
      // Try harder: use items already used
      if (tops.length > 0 && outfitItems.length < 2) {
        const fallback = pickRandom(tops);
        if (fallback) {
          outfitItems.push({ itemId: fallback.id, role: "top" });
          selected.push(fallback);
        }
      }
      if (bottoms.length > 0 && outfitItems.length < 2) {
        const fallback = pickRandom(bottoms);
        if (fallback) {
          outfitItems.push({ itemId: fallback.id, role: "bottom" });
          selected.push(fallback);
        }
      }
      if (shoes.length > 0 && outfitItems.length < 2) {
        const fallback = pickRandom(shoes);
        if (fallback) {
          outfitItems.push({ itemId: fallback.id, role: "shoes" });
          selected.push(fallback);
        }
      }
    }

    const mood = assignMood(selected, uniqueMoods, usedMoods);
    usedMoods.add(mood);

    outfits.push({
      name: generateOutfitName(mood, selected),
      mood,
      weatherNote: generateWeatherNote(temperature, mood),
      items: outfitItems,
    });
  }

  return outfits;
}

router.post("/suggest-outfits", (req, res) => {
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
    res.json({ outfits: [] });
    return;
  }

  const outfits = generateOutfitsLocally(items, temperature);
  res.json({ outfits });
});

export default router;
