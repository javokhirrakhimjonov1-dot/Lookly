export type TempTier = "freezing" | "cold" | "cool" | "mild" | "warm" | "hot";
export type ShopKind = "tops" | "bottoms" | "outerwear" | "shoes" | "accessories";

export interface ClimateShopProduct {
  kind: ShopKind;
  name: string;
  supportedTiers: readonly TempTier[];
  rainSafe?: boolean;
  audience?: "female" | "male" | "all";
}

export interface ClimateWardrobeItem {
  name: string;
  category: string;
  seasons: readonly string[];
  fabricWeight: "light" | "medium" | "heavy";
  tags: readonly string[];
  timesWorn: number;
}

export interface DailyTemperature {
  tempMax: number;
  tempMin: number;
}

export interface MissingChecklistItem {
  name: string;
  quantity: number;
}

export interface GeoLabelParts {
  name: string;
  admin1?: string;
  country?: string;
}

function samePlaceLabel(left?: string, right?: string): boolean {
  return !!left?.trim() && !!right?.trim()
    && left.trim().localeCompare(right.trim(), undefined, { sensitivity: "base" }) === 0;
}

/** Formats geocoder results without repeating city-states such as Istanbul. */
export function formatGeoLabel(place: GeoLabelParts): string {
  const name = place.name.trim();
  const admin1 = samePlaceLabel(name, place.admin1) ? "" : place.admin1?.trim();
  return [name, admin1, place.country?.trim()].filter(Boolean).join(", ");
}

export function formatGeoRegion(place: GeoLabelParts): string {
  const admin1 = samePlaceLabel(place.name, place.admin1) ? "" : place.admin1?.trim();
  return [admin1, place.country?.trim()].filter(Boolean).join(", ");
}

export function getTier(temp: number): TempTier {
  if (temp <= 0) return "freezing";
  if (temp <= 10) return "cold";
  if (temp <= 17) return "cool";
  if (temp <= 24) return "mild";
  if (temp <= 30) return "warm";
  return "hot";
}

export function getTripClimate(forecasts: readonly DailyTemperature[]) {
  const avgHigh = forecasts.reduce((sum, day) => sum + day.tempMax, 0) / forecasts.length;
  const avgLow = forecasts.reduce((sum, day) => sum + day.tempMin, 0) / forecasts.length;
  const coldestLow = Math.min(...forecasts.map((day) => day.tempMin));
  return {
    avgHigh,
    avgLow,
    coldestLow,
    summaryTier: getTier((avgHigh + avgLow) / 2),
    safetyTier: getTier(coldestLow),
  };
}

export function tierForKind(kind: ShopKind, summaryTier: TempTier, safetyTier: TempTier): TempTier {
  return kind === "outerwear" || kind === "shoes" ? safetyTier : summaryTier;
}

export function isOpenToeName(name: string): boolean {
  return /sandal|slide|open[ -]?toe|flip[ -]?flop|slipper/i.test(name);
}

export function filterClimateSafeProducts<T extends ClimateShopProduct>(
  products: readonly T[],
  kind: ShopKind,
  tier: TempTier,
  hasRain: boolean,
): T[] {
  return products.filter((item) => {
    if (item.kind !== kind || !item.supportedTiers.includes(tier)) return false;
    if (kind === "shoes" && (hasRain || tier === "freezing" || tier === "cold" || tier === "cool")) {
      if (isOpenToeName(item.name)) return false;
      if (hasRain && !item.rainSafe) return false;
    }
    return true;
  });
}

export function filterProfileShopProducts<T extends ClimateShopProduct>(
  products: readonly T[],
  gender: string | null | undefined,
): T[] {
  if (gender !== "female" && gender !== "male") {
    return products.filter((item) => item.audience === "all" || item.audience == null);
  }
  return products.filter((item) => item.audience === gender || item.audience === "all");
}

export function isOpenToeFootwear(item: Pick<ClimateWardrobeItem, "name" | "tags">): boolean {
  return isOpenToeName(`${item.name} ${item.tags.join(" ")}`);
}

export function isClearlyClosedToeFootwear(item: Pick<ClimateWardrobeItem, "name" | "tags">): boolean {
  const text = `${item.name} ${item.tags.join(" ")}`.toLowerCase();
  return ["closed-toe", "sneaker", "trainer", "boot", "loafer", "oxford", "derby", "moccasin"].some(
    (word) => text.includes(word),
  );
}

export function isWardrobeClimateCompatible(item: ClimateWardrobeItem, tier: TempTier): boolean {
  const text = `${item.name} ${item.tags.join(" ")}`.toLowerCase();
  const hasAny = (words: string[]) => words.some((word) => text.includes(word));
  const hasWinterSignal = hasAny([
    "insulated", "winter", "snow", "thermal", "heat-tech", "fleece", "lined", "puffer", "down", "parka", "wool",
  ]);

  if (tier === "freezing") {
    if (item.category === "shoes") {
      return isClearlyClosedToeFootwear(item)
        && (hasWinterSignal || (hasAny(["boot"]) && item.seasons.includes("winter")));
    }
    if (item.category === "outerwear") return item.fabricWeight === "heavy" || hasWinterSignal;
    return item.fabricWeight === "heavy"
      || hasWinterSignal
      || (item.fabricWeight === "medium" && item.seasons.includes("winter"));
  }

  if (tier === "cold") {
    if (item.category === "shoes") return isClearlyClosedToeFootwear(item);
    return item.fabricWeight !== "light" || hasWinterSignal;
  }

  if (tier === "hot") return item.fabricWeight !== "heavy";
  return true;
}

export function rankWardrobeForTrip<T extends ClimateWardrobeItem>(
  items: readonly T[],
  tier: TempTier,
  hasRain: boolean,
): T[] {
  const preferredWeight: Record<TempTier, Record<ClimateWardrobeItem["fabricWeight"], number>> = {
    freezing: { light: -5, medium: 1, heavy: 6 },
    cold: { light: -4, medium: 2, heavy: 5 },
    cool: { light: -1, medium: 4, heavy: 3 },
    mild: { light: 2, medium: 4, heavy: 1 },
    warm: { light: 5, medium: 2, heavy: -2 },
    hot: { light: 6, medium: 1, heavy: -4 },
  };
  const weatherWords = hasRain
    ? ["waterproof", "water-resistant", "rain", "quick-dry", "hood", "rubber"]
    : tier === "hot" || tier === "warm"
      ? ["linen", "cotton", "breathable", "light", "short", "mesh"]
      : tier === "cold" || tier === "freezing"
        ? ["wool", "thermal", "knit", "coat", "puffer", "fleece", "insulated", "down"]
        : ["layer", "overshirt", "jacket", "cardigan", "denim"];

  return [...items].sort((a, b) => {
    const score = (item: T) => {
      const text = `${item.name} ${item.tags.join(" ")}`.toLowerCase();
      const winterBonus = (tier === "freezing" || tier === "cold") && item.seasons.includes("winter") ? 4 : 0;
      return preferredWeight[tier][item.fabricWeight]
        + winterBonus
        + weatherWords.reduce((total, word) => total + (text.includes(word) ? 3 : 0), 0)
        - Math.min(item.timesWorn, 3) * 0.15;
    };
    return score(b) - score(a) || a.name.localeCompare(b.name);
  });
}

export function packingOptions(kind: ShopKind, tier: TempTier, hasRain: boolean): string[] {
  const rainy = hasRain && tier !== "freezing" && tier !== "cold" ? {
    tops: ["Quick-dry long-sleeve top", "Light merino layer", "Breathable overshirt", "Moisture-wicking tee"],
    bottoms: ["Water-resistant trousers", "Quick-dry chinos", "Dark straight-leg jeans", "Technical midi skirt"],
    outerwear: ["Packable waterproof shell", "Hooded rain jacket", "Water-resistant trench", "Light rain poncho"],
    shoes: ["Waterproof sneakers", "Leather ankle boots", "Rubber-soled loafers", "Quick-dry walking shoes"],
    accessories: ["Compact umbrella", "Water-resistant crossbody bag", "Cap with visor", "Spare quick-dry socks"],
  } : null;
  if (rainy) return rainy[kind];

  const options: Record<TempTier, Record<ShopKind, string[]>> = {
    freezing: {
      tops: ["Thermal base layer", "Merino wool turtleneck", "Heavy knit sweater", "Fleece half-zip", "Long-sleeve heat-tech top"],
      bottoms: ["Lined trousers", "Thermal leggings", "Heavy denim jeans", "Wool-blend trousers"],
      outerwear: ["Insulated puffer coat", "Wool overcoat", "Down parka", "Weatherproof winter jacket"],
      shoes: ["Insulated boots", "Waterproof leather boots", "Rubber-soled winter shoes"],
      accessories: ["Wool scarf", "Warm beanie", "Leather gloves", "Thick wool socks"],
    },
    cold: {
      tops: ["Fine-knit jumper", "Long-sleeve cotton shirt", "Merino crewneck", "Fleece pullover", "Layering turtleneck"],
      bottoms: ["Straight-leg jeans", "Wool-blend trousers", "Corduroy trousers", "Midi skirt with tights"],
      outerwear: ["Wool coat", "Quilted jacket", "Puffer vest", "Structured trench coat"],
      shoes: ["Ankle boots", "Leather sneakers", "Chunky loafers", "Closed-toe flats"],
      accessories: ["Light scarf", "Beanie", "Crossbody bag", "Warm socks"],
    },
    cool: {
      tops: ["Oxford shirt", "Light knit polo", "Long-sleeve tee", "Fine cardigan", "Cotton overshirt"],
      bottoms: ["Relaxed trousers", "Dark jeans", "Midi skirt", "Tailored chinos"],
      outerwear: ["Denim jacket", "Light blazer", "Bomber jacket", "Cotton trench"],
      shoes: ["Clean sneakers", "Loafers", "Ankle boots", "Ballet flats"],
      accessories: ["Light scarf", "Leather belt", "Crossbody bag", "Sunglasses"],
    },
    mild: {
      tops: ["Crisp cotton shirt", "Lightweight knit polo", "Fitted tee", "Fine cardigan", "Linen-blend blouse", "Breathable overshirt"],
      bottoms: ["Tailored chinos", "Wide-leg trousers", "Dark straight jeans", "Midi skirt", "Light denim"],
      outerwear: ["Unstructured blazer", "Light denim jacket", "Cotton overshirt"],
      shoes: ["Leather sneakers", "Loafers", "Slingback flats", "Low-profile trainers"],
      accessories: ["Sunglasses", "Leather belt", "Small shoulder bag", "Light scarf"],
    },
    warm: {
      tops: ["Linen button-up shirt", "Cotton crew-neck tee", "Breathable polo", "Sleeveless blouse", "Lightweight camp-collar shirt", "Ribbed tank layer"],
      bottoms: ["Linen trousers", "Cotton chinos", "Flowy midi skirt", "Lightweight shorts", "Wide-leg cotton trousers"],
      outerwear: ["Light linen overshirt", "Packable windbreaker"],
      shoes: ["Canvas sneakers", "Leather sandals", "Loafers", "Open-back mules"],
      accessories: ["Sunglasses", "Sun cap", "Light tote bag", "Breathable socks"],
    },
    hot: {
      tops: ["Linen camp-collar shirt", "Lightweight cotton tee", "Sleeveless linen top", "Breathable polo", "Loose-fit short-sleeve shirt", "Cotton tank"],
      bottoms: ["Linen shorts", "Flowy skirt", "Lightweight chinos", "Cotton shorts", "Relaxed linen trousers"],
      outerwear: ["UV-protective overshirt", "Ultra-light wind layer"],
      shoes: ["Leather sandals", "Breathable sneakers", "Open-toe flats", "Canvas slip-ons"],
      accessories: ["Wide-brim hat", "UV sunglasses", "Refillable water bottle", "Lightweight tote"],
    },
  };
  return options[tier][kind];
}

export function buildMissingChecklist(
  kind: ShopKind,
  missingCount: number,
  tier: TempTier,
  hasRain: boolean,
): MissingChecklistItem[] {
  if (missingCount <= 0) return [];
  const options = packingOptions(kind, tier, hasRain).slice(0, missingCount);
  return options.map((name, index) => ({
    name,
    quantity: Math.floor(missingCount / options.length) + (index < missingCount % options.length ? 1 : 0),
  }));
}
