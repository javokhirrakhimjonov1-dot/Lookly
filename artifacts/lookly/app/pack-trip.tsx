import { Feather } from "@/components/FeatherIcon";
import { Image } from "expo-image";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getTopPadding, getBottomPadding } from "@/constants/layout";
import { useColors } from "@/hooks/useColors";
import { useWardrobe, type ClothingItem } from "@/contexts/WardrobeContext";
import { useUserProfile, type Gender, type StylingPreferences } from "@/contexts/UserProfileContext";
import { useLanguage, type Language } from "@/contexts/LanguageContext";
import { packTripCountWord, packTripLocale, packTripProductName, packTripText } from "@/lib/packTripI18n";
import {
  filterClimateSafeProducts,
  filterProfileShopProducts,
  formatGeoLabel,
  formatGeoRegion,
  getTripClimate,
  getTier,
  isClearlyClosedToeFootwear,
  isOpenToeFootwear,
  isWardrobeClimateCompatible,
  rankWardrobeForTrip,
  tierForKind,
  type ShopKind,
  type TempTier,
} from "@/lib/packTripClimate";
import { packingSeparateTargets } from "@/lib/outfitComposition";
import { isAutomaticItemEligible, isHijabItem } from "@/lib/modestyRules";
import { getGarmentTone } from "@/lib/garmentTone";
import {
  getShopSuggestionType,
  isVerifiedModestShopType,
  shopSuggestionTypeLabel,
  type ShopSuggestionType,
} from "@/lib/shopSuggestionPreferences";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface DailyForecast {
  date: string;
  tempMax: number;
  tempMin: number;
  precipitation: number;
}

interface GeoSuggestion {
  name: string;
  country: string;
  admin1?: string;
  latitude: number;
  longitude: number;
}

const TIER_NAME_KEY: Record<TempTier, Parameters<typeof packTripText>[1]> = {
  freezing: "tierFreezing", cold: "tierCold", cool: "tierCool",
  mild: "tierMild", warm: "tierWarm", hot: "tierHot",
};

const TIER_DESC_KEY: Record<TempTier, Parameters<typeof packTripText>[1]> = {
  freezing: "tierFreezingDesc", cold: "tierColdDesc", cool: "tierCoolDesc",
  mild: "tierMildDesc", warm: "tierWarmDesc", hot: "tierHotDesc",
};

interface PackingCategory {
  category: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  needed: number;
  reason: string;
  weatherTier: TempTier;
  hasRain: boolean;
  fromWardrobe: ClothingItem[];
  needToBuy: ShopProduct[];
  missingCount?: number;
}

// ─────────────────────────────────────────────
// Buy-item image mapping
// ─────────────────────────────────────────────
interface ShopProduct {
  id: string;
  kind: ShopKind;
  name: string;
  store: "Just2010" | "TerraPro";
  imageUrl: string;
  productUrl: string;
  priceUz: number;
  supportedTiers: readonly TempTier[];
  rainSafe?: boolean;
  weatherReason?: string;
  audience: "female" | "male" | "all";
}

const SHOP_PRODUCTS: ShopProduct[] = [
  { id: "just-women-jumper-473338", audience: "female", kind: "tops", name: "Women's knit jumper", store: "Just2010", priceUz: 99900, supportedTiers: ["freezing", "cold", "cool", "mild"], productUrl: "https://just2010.uz/uz/catalog/svitera_i_kardigany_/473338/", imageUrl: "https://just2010.uz/upload/iblock/f8b/gv8a8z1it0wo1y5j4i5tlj5lxsihw1sj.webp" },
  { id: "just-women-jumper-473326", audience: "female", kind: "tops", name: "Women's warm jumper", store: "Just2010", priceUz: 139900, supportedTiers: ["freezing", "cold", "cool", "mild"], productUrl: "https://just2010.uz/uz/catalog/svitera_i_kardigany_/473326/", imageUrl: "https://just2010.uz/upload/iblock/56c/y7gjso8ilt9so3d1y18ke5ixd89c40x6.webp" },
  { id: "just-women-blouse-striped", audience: "female", kind: "tops", name: "Striped tie-front blouse", store: "Just2010", priceUz: 129900, supportedTiers: ["mild", "warm", "hot"], productUrl: "https://just2010.uz/uz/catalog/bluzki_i_rubashki/489852/", imageUrl: "https://just2010.uz/upload/iblock/c42/udk8767lfs5i63va8apt4jc1dzti27cr.jpg" },
  { id: "just-women-blouse-cotton", audience: "female", kind: "tops", name: "Women's cotton blouse", store: "Just2010", priceUz: 159900, supportedTiers: ["mild", "warm", "hot"], productUrl: "https://just2010.uz/uz/catalog/bluzki_i_rubashki/489851/", imageUrl: "https://just2010.uz/upload/iblock/64c/vaqnbkiistknfqahhdwfuety4kmwvq9s.jpg" },
  { id: "just-women-blouse-light", audience: "female", kind: "tops", name: "Lightweight women's blouse", store: "Just2010", priceUz: 129900, supportedTiers: ["mild", "warm", "hot"], productUrl: "https://just2010.uz/uz/catalog/bluzki_i_rubashki/489849/", imageUrl: "https://just2010.uz/upload/iblock/87c/osxzhy01hlhgu7hciqug71gkclcdw12f.jpg" },
  { id: "just-women-cotton-tee", audience: "female", kind: "tops", name: "Women's cotton T-shirt", store: "Just2010", priceUz: 89900, supportedTiers: ["mild", "warm", "hot"], productUrl: "https://just2010.uz/uz/catalog/futbolki_1/489860/", imageUrl: "https://just2010.uz/upload/iblock/f5e/ox14uvbsu4izuhlzzokglrxzd9iqjovz.jpg" },
  { id: "just-women-shorts", audience: "female", kind: "bottoms", name: "Women's lightweight shorts", store: "Just2010", priceUz: 139900, supportedTiers: ["warm", "hot"], productUrl: "https://just2010.uz/uz/catalog/shorty_1/489865/", imageUrl: "https://just2010.uz/upload/iblock/ce8/snvv9xqedfxgje43hy2cgwal6khy22su.jpg" },
  { id: "just-women-skirt", audience: "female", kind: "bottoms", name: "Women's summer skirt", store: "Just2010", priceUz: 109900, supportedTiers: ["mild", "warm", "hot"], productUrl: "https://just2010.uz/uz/catalog/yubki/489855/", imageUrl: "https://just2010.uz/upload/iblock/9e8/g72oymqraxqcudwnh9xlbhkapdj32gx7.jpg" },
  { id: "just-women-trousers", audience: "female", kind: "bottoms", name: "Women's relaxed trousers", store: "Just2010", priceUz: 159900, supportedTiers: ["freezing", "cold", "cool", "mild", "warm"], productUrl: "https://just2010.uz/uz/catalog/bryuki_/489861/", imageUrl: "https://just2010.uz/upload/iblock/7e0/2da5lvcvtd1f8jd1gvn4xkfgl7t9syw0.jpg" },
  { id: "just-women-trousers-489853", audience: "female", kind: "bottoms", name: "Women's straight trousers", store: "Just2010", priceUz: 289900, supportedTiers: ["freezing", "cold", "cool", "mild"], productUrl: "https://just2010.uz/uz/catalog/bryuki_/489853/", imageUrl: "https://just2010.uz/upload/iblock/7ad/sborn8jwz1cp3chtiwmcck463kjzn1wm.jpg" },
  { id: "just-women-trousers-489848", audience: "female", kind: "bottoms", name: "Women's full-length trousers", store: "Just2010", priceUz: 289900, supportedTiers: ["freezing", "cold", "cool", "mild"], productUrl: "https://just2010.uz/uz/catalog/bryuki_/489848/", imageUrl: "https://just2010.uz/upload/iblock/374/ibox0dwgjmmhmsr5m65sjxaxdo3e5sks.jpg" },
  { id: "terra-women-hoodie", audience: "female", kind: "tops", name: "Women's warm hoodie", store: "TerraPro", priceUz: 59990, supportedTiers: ["freezing", "cold", "cool", "mild"], productUrl: "https://terrapro.uz/woman/shares/zhenskoe-khudi/202840/?oid=207029", imageUrl: "https://terrapro.uz/upload/resize_cache/iblock/c93/600_900_1/ctul5qlqxlz8m0wn6n9n8tc8bu09ecj7.jpg" },
  { id: "terra-women-long-sleeve", audience: "female", kind: "tops", name: "Women's long-sleeve top", store: "TerraPro", priceUz: 179990, supportedTiers: ["cold", "cool", "mild"], productUrl: "https://terrapro.uz/woman/catalog/zhenskiy-longsliv/341639/?oid=343048", imageUrl: "https://terrapro.uz/upload/resize_cache/iblock/fad/435_544_1/ijy7fh1w352qcyq5ftox4s1c3ftyrt5i.jpg" },
  { id: "terra-women-tee", audience: "female", kind: "tops", name: "Women's cotton T-shirt", store: "TerraPro", priceUz: 229990, supportedTiers: ["mild", "warm", "hot"], productUrl: "https://terrapro.uz/woman/catalog/zhenskaya-futbolka/341540/?oid=343020", imageUrl: "https://terrapro.uz/upload/resize_cache/iblock/749/435_544_1/32vyocjg6kz1awfvfm5bv8g0yuetz2wi.jpg" },
  { id: "terra-women-joggers", audience: "female", kind: "bottoms", name: "Women's cotton joggers", store: "TerraPro", priceUz: 99990, supportedTiers: ["cool", "mild", "warm"], productUrl: "https://terrapro.uz/woman/shares/zhenskie-dzhoggery/148070/?oid=149815", imageUrl: "https://terrapro.uz/upload/resize_cache/iblock/456/3vlh5zz7n9p0vbdtdrk1m2pu6295d5eq/600_900_1/optimized_SS24WES-21123-1%206.jpg" },
  { id: "just-tee", audience: "male", kind: "tops", name: "Essential cotton tee", store: "Just2010", priceUz: 99900, supportedTiers: ["mild", "warm", "hot"], productUrl: "https://just2010.uz/catalog/futbolki/489435/", imageUrl: "https://just2010.uz/upload/iblock/eee/buorh58k93lo4xp6js1jggze2gglpwec.jpg" },
  { id: "just-overshirt", audience: "male", kind: "outerwear", name: "Lightweight overshirt", store: "Just2010", priceUz: 109900, supportedTiers: ["cool", "mild", "warm"], productUrl: "https://just2010.uz/catalog/rubashki/489427/", imageUrl: "https://just2010.uz/upload/iblock/95d/mu4juweaixfrrqcomfugv14gvmqdai7l.jpg" },
  { id: "just-trousers", audience: "male", kind: "bottoms", name: "Classic trousers", store: "Just2010", priceUz: 199900, supportedTiers: ["cold", "cool", "mild", "warm"], productUrl: "https://just2010.uz/catalog/bryuki_1/483373/", imageUrl: "https://just2010.uz/upload/iblock/88f/jv85t9zle49ocxtfkc4aqce2m6vqtdso.jpg" },
  { id: "just-jeans", audience: "male", kind: "bottoms", name: "Straight-fit jeans", store: "Just2010", priceUz: 189900, supportedTiers: ["cold", "cool", "mild", "warm"], productUrl: "https://just2010.uz/catalog/dzhinsy/489426/", imageUrl: "https://just2010.uz/upload/iblock/e39/uetul3n9nbgxc5057bbs3ly70c6o5896.jpg" },
  { id: "just-chinos", audience: "male", kind: "bottoms", name: "Lightweight chinos", store: "Just2010", priceUz: 199900, supportedTiers: ["cool", "mild", "warm"], productUrl: "https://just2010.uz/catalog/chinosy/489431/", imageUrl: "https://just2010.uz/upload/iblock/346/x3q1i44qotpcmq2mg0as3ysaknnpijyc.jpg" },
  // The supplier image is an open sandal. Its name must match the actual product
  // so we never promise closed-toe rain protection for an open-toe shoe.
  { id: "just-shoes", audience: "male", kind: "shoes", name: "Everyday open-toe sandals", store: "Just2010", priceUz: 239900, supportedTiers: ["warm", "hot"], productUrl: "https://just2010.uz/catalog/obuv/489440/", imageUrl: "https://just2010.uz/upload/iblock/ba8/pwgayysbwib6m4bl4b4gsf04go7usmev.jpg" },
  { id: "just-belt", audience: "male", kind: "accessories", name: "Leather belt", store: "Just2010", priceUz: 109900, supportedTiers: ["mild", "warm", "hot"], productUrl: "https://just2010.uz/catalog/sumki_i_aksessuary/484185/", imageUrl: "https://just2010.uz/upload/iblock/480/fm6bu21y4wx5bk7fm5bhuz8b3rpu9nmb.jpg" },
  { id: "terra-tee-black", audience: "male", kind: "tops", name: "TerraPro cotton T-shirt", store: "TerraPro", priceUz: 149990, supportedTiers: ["mild", "warm", "hot"], productUrl: "https://terrapro.uz/catalog/futbolka_1/149031/", imageUrl: "https://terrapro.uz/upload/iblock/251/tt1cosm0942zjyr3gsf1wkotk40ruvgi/optimized_SS24CR2-25-20246%201.jpg" },
  { id: "terra-tee-light", audience: "male", kind: "tops", name: "TerraPro short-sleeve T-shirt", store: "TerraPro", priceUz: 199990, supportedTiers: ["warm", "hot"], productUrl: "https://terrapro.uz/catalog/futbolka_1/210168/", imageUrl: "https://terrapro.uz/upload/iblock/3e0/8hkcebjf32unt917j3mv4buup9reg68o.jpg" },
  { id: "terra-tee-classic", audience: "male", kind: "tops", name: "TerraPro premium T-shirt", store: "TerraPro", priceUz: 199990, supportedTiers: ["mild", "warm", "hot"], productUrl: "https://terrapro.uz/catalog/futbolka_1/147980/", imageUrl: "https://terrapro.uz/upload/iblock/f35/jju0l8thz0qdi5jnqak7gcpkkup8cc5m/optimized_SS24CL2-25-19784%20%201.jpg" },
];

/** Explain the practical weather benefit without guessing unverified product specs. */
function shopWeatherReason(item: ShopProduct, tier: TempTier, hasRain: boolean, lang: Language): string {
  const productName = item.name.toLowerCase();
  const openToe = /sandal|slide|open-toe|flip.?flop/.test(productName);

  if (hasRain) {
    if (item.kind === "shoes") {
      return openToe
        ? packTripText(lang, "shopRainOpenToe")
        : packTripText(lang, "shopRainClosedShoe");
    }
    if (item.kind === "outerwear") return packTripText(lang, "shopRainOuterwear");
    if (item.kind === "bottoms") return packTripText(lang, "shopRainBottoms");
    if (productName.includes("cotton")) return packTripText(lang, "shopRainCotton");
    if (productName.includes("short-sleeve")) return packTripText(lang, "shopRainShortSleeve");
    return packTripText(lang, "shopRainGeneric");
  }

  if (tier === "hot" || tier === "warm") {
    if (productName.includes("linen") || productName.includes("lightweight")) {
      return packTripText(lang, "shopWarmLight");
    }
    if (item.kind === "tops") {
      if (productName.includes("essential")) return packTripText(lang, "shopWarmEssential");
      if (productName.includes("premium")) return packTripText(lang, "shopWarmPremium");
      return packTripText(lang, "shopWarmTop");
    }
    if (item.kind === "shoes") return packTripText(lang, openToe ? "shopWarmOpenToe" : "shopWarmShoe");
    if (item.kind === "bottoms") return packTripText(lang, productName.includes("jean") ? "shopWarmJeans" : "shopWarmBottoms");
    return packTripText(lang, "shopWarmGeneric");
  }

  if (tier === "freezing" || tier === "cold") {
    if (item.kind === "outerwear") return packTripText(lang, "shopColdOuterwear");
    if (item.kind === "bottoms") return packTripText(lang, "shopColdBottoms");
    if (item.kind === "shoes") return packTripText(lang, "shopColdShoes");
    return packTripText(lang, "shopColdGeneric");
  }

  if (tier === "cool") {
    if (item.kind === "outerwear") return packTripText(lang, "shopCoolOuterwear");
    if (item.kind === "bottoms") return packTripText(lang, "shopCoolBottoms");
    return packTripText(lang, "flexibleWeather");
  }

  return packTripText(lang, "comfortableWeather");
}

function shopSuggestions(
  kind: ShopKind,
  count: number,
  tier: TempTier,
  hasRain: boolean,
  lang: Language,
  gender: Gender | null,
  preferences: StylingPreferences,
): ShopProduct[] {
  const excluded = new Set(preferences.excludedShopTypes);
  const profileMatches = filterProfileShopProducts(SHOP_PRODUCTS, gender).filter((item) => {
    const type = getShopSuggestionType(item.name);
    if (excluded.has(type)) return false;
    return preferences.hijabPreference !== "always" || isVerifiedModestShopType(type, item.kind);
  });
  const matches = filterClimateSafeProducts(profileMatches, kind, tier, hasRain);
  const byStore = {
    Just2010: matches.filter((item) => item.store === "Just2010"),
    TerraPro: matches.filter((item) => item.store === "TerraPro"),
  };
  const balanced: ShopProduct[] = [];
  for (let index = 0; balanced.length < matches.length; index += 1) {
    for (const store of ["Just2010", "TerraPro"] as const) {
      const item = byStore[store][index];
      if (item) balanced.push(item);
    }
  }

  return balanced
    .slice(0, Math.max(0, count))
    .map((item) => ({ ...item, weatherReason: shopWeatherReason(item, tier, hasRain, lang) }));
}

/** Only add accessories that solve a real weather need. This prevents a
 * scarf, gym accessory, or belt from appearing merely because it is owned. */
function isWeatherRelevantAccessory(item: ClothingItem, tier: TempTier, hasRain: boolean): boolean {
  const text = `${item.name} ${item.tags.join(" ")}`.toLowerCase();
  const includesAny = (words: string[]) => words.some((word) => text.includes(word));
  if (hasRain) return includesAny(["umbrella", "rain", "waterproof", "water-resistant", "quick-dry", "visor", "cap"]);
  if (tier === "freezing" || tier === "cold") return includesAny(["scarf", "beanie", "glove", "wool sock", "thermal sock"]);
  if (tier === "cool") return includesAny(["light scarf", "scarf", "cap", "sunglass"]);
  // Mild-to-hot trips need sun protection, not winter accessories.
  return includesAny(["sunglass", "sun hat", "sunhat", "cap", "visor", "uv"]);
}

function wardrobeWeatherReason(item: ClothingItem, tier: TempTier, hasRain: boolean, lang: Language): string {
  const text = `${item.name} ${item.tags.join(" ")}`.toLowerCase();
  const openToe = isOpenToeFootwear(item);
  if (hasRain) {
    if (item.category === "shoes") return openToe
      ? packTripText(lang, "wardrobeRainOpenToe")
      : packTripText(lang, "wardrobeRainClosedShoe");
    if (text.includes("waterproof") || text.includes("water-resistant")) return packTripText(lang, "wardrobeRainResistant");
    if (item.category === "outerwear") return packTripText(lang, "wardrobeRainOuterwear");
    if (item.category === "bottoms") return packTripText(lang, "wardrobeRainBottoms");
    if (text.includes("cotton") || text.includes("short sleeve")) return packTripText(lang, "wardrobeRainBase");
    return packTripText(lang, "wardrobeRainGeneric");
  }
  if (tier === "hot" || tier === "warm") {
    if (item.fabricWeight === "light" || ["linen", "cotton", "mesh", "breathable", "short"].some((word) => text.includes(word))) return packTripText(lang, "wardrobeWarmLight");
    if (item.category === "shoes") return packTripText(lang, openToe ? "wardrobeWarmOpenToe" : "wardrobeWarmShoe");
    if (item.category === "bottoms") return packTripText(lang, "wardrobeWarmBottoms");
    return packTripText(lang, "wardrobeWarmGeneric");
  }
  if (tier === "freezing" || tier === "cold") {
    if (item.fabricWeight === "heavy") return packTripText(lang, "wardrobeColdHeavy");
    if (item.category === "shoes") return packTripText(lang, "wardrobeColdShoes");
    return packTripText(lang, "wardrobeColdGeneric");
  }
  if (tier === "cool") {
    if (item.category === "shoes") return packTripText(lang, "wardrobeCoolShoes");
    if (item.category === "bottoms") return packTripText(lang, "wardrobeCoolBottoms");
    if (item.category === "outerwear") return packTripText(lang, "wardrobeCoolOuterwear");
    return packTripText(lang, "wardrobeCoolGeneric");
  }
  return packTripText(lang, "comfortableWeather");
}

// ─────────────────────────────────────────────
// Packing logic
// ─────────────────────────────────────────────
function generatePackingList(
  days: number,
  forecasts: DailyForecast[],
  wardrobe: ClothingItem[],
  hasRain: boolean,
  lang: Language,
  gender: Gender | null,
  stylingPreferences: ReturnType<typeof useUserProfile>["stylingPreferences"],
): PackingCategory[] {
  const { avgHigh, avgLow, coldestLow, summaryTier: tripTier, safetyTier } = getTripClimate(forecasts);
  const needsOuterwear = coldestLow <= 17;
  const needsHeavy = coldestLow <= 10;
  const isHot = avgHigh > 28;

  const weightOk = (item: ClothingItem) => {
    if (isHot && item.fabricWeight === "heavy") return false;
    if (needsHeavy && item.fabricWeight === "light") return false;
    return true;
  };

  const topsNeeded = Math.ceil(days * 1.2);
  const bottomsNeeded = Math.max(2, Math.ceil(days * 0.6));
  const shoesNeeded = Math.min(3, Math.max(1, Math.ceil(days / 3)));
  const outerNeeded = needsOuterwear ? Math.min(2, Math.ceil(days / 4)) : 0;

  const eligible = (item: ClothingItem) => isAutomaticItemEligible(item, stylingPreferences);
  const tops = rankWardrobeForTrip(wardrobe.filter((i) => i.category === "tops" && eligible(i) && weightOk(i) && isWardrobeClimateCompatible(i, tripTier)), tripTier, hasRain);
  const bottoms = rankWardrobeForTrip(wardrobe.filter((i) => i.category === "bottoms" && eligible(i) && weightOk(i) && isWardrobeClimateCompatible(i, tripTier)), tripTier, hasRain);
  const dresses = rankWardrobeForTrip(wardrobe.filter((i) => i.category === "dresses" && eligible(i) && weightOk(i) && isWardrobeClimateCompatible(i, tripTier)), tripTier, hasRain);
  const outer = rankWardrobeForTrip(
    wardrobe.filter((i) => i.category === "outerwear" && eligible(i) && isWardrobeClimateCompatible(i, safetyTier)),
    safetyTier,
    hasRain,
  );
  const allShoes = wardrobe.filter((i) => i.category === "shoes");
  // Wet pavements and cool days need closed footwear. Unknown footwear is not
  // suggested until its type is confirmed in the item form.
  const needsClosedToeShoes = hasRain || coldestLow < 22;
  const shoeCandidates = (needsClosedToeShoes
    ? allShoes.filter((item) => !isOpenToeFootwear(item) && isClearlyClosedToeFootwear(item))
    : allShoes).filter((item) => isWardrobeClimateCompatible(item, safetyTier));
  const shoes = rankWardrobeForTrip(shoeCandidates, safetyTier, hasRain);
  const hijabs = wardrobe.filter(isHijabItem);
  const access = rankWardrobeForTrip(
    wardrobe.filter((i) => i.category === "accessories" && !isHijabItem(i) && isWeatherRelevantAccessory(i, tripTier, hasRain)),
    tripTier,
    hasRain,
  );

  const result: PackingCategory[] = [];

  const fillMissing = (kind: ShopKind, needed: number, owned: number) => {
    const recommendationTier = tierForKind(kind, tripTier, safetyTier);
    const missingBeforeShop = Math.max(0, needed - owned);
    const needToBuy = shopSuggestions(
      kind,
      missingBeforeShop,
      recommendationTier,
      hasRain,
      lang,
      gender,
      stylingPreferences,
    );
    return {
      needToBuy,
      missingCount: Math.max(0, missingBeforeShop - needToBuy.length) || undefined,
    };
  };

  // A one-piece covers both the top and bottom for one outfit day. Count it
  // once and reduce both separates targets instead of requiring a redundant top.
  const targets = packingSeparateTargets(topsNeeded, bottomsNeeded, dresses.length);
  const dressMatches = dresses.slice(0, targets.dressesUsed);
  const effectiveTopsNeeded = targets.topsNeeded;
  const effectiveBottomsNeeded = targets.bottomsNeeded;
  const topMatches = tops.slice(0, effectiveTopsNeeded);
  const topGaps = fillMissing("tops", effectiveTopsNeeded, topMatches.length);

  result.push({
    category: "cat_tops",
    icon: "wind",
    needed: effectiveTopsNeeded,
    weatherTier: tripTier,
    hasRain,
    reason: packTripText(lang, "topsReason", { needed: effectiveTopsNeeded, days, dayWord: packTripCountWord(lang, days, "day"), temp: Math.round(avgHigh) }),
    fromWardrobe: topMatches,
    ...topGaps,
  });

  const separatesBottoms = bottoms.slice(0, effectiveBottomsNeeded);
  const bottomMatches = [...dressMatches, ...separatesBottoms];
  const bottomGaps = fillMissing("bottoms", effectiveBottomsNeeded, separatesBottoms.length);
  result.push({
    category: "cat_bottoms",
    icon: "minus",
    needed: bottomsNeeded,
    weatherTier: tripTier,
    hasRain,
    reason: packTripText(lang, "bottomsReason", { needed: bottomsNeeded }),
    fromWardrobe: bottomMatches,
    ...bottomGaps,
  });

  if (needsOuterwear && outerNeeded > 0) {
    const outerMatches = outer.slice(0, outerNeeded);
    const outerGaps = fillMissing("outerwear", outerNeeded, outerMatches.length);
    result.push({
      category: "cat_outerwear",
      icon: "layers",
      needed: outerNeeded,
      weatherTier: tripTier,
      hasRain,
      reason: packTripText(lang, needsHeavy ? "heavyCoatReason" : "lightJacketReason"),
      fromWardrobe: outerMatches,
      ...outerGaps,
    });
  }

  const shoeMatches = shoes.slice(0, shoesNeeded);
  const shoeGaps = fillMissing("shoes", shoesNeeded, shoeMatches.length);
  result.push({
    category: "cat_shoes",
    icon: "chevrons-up",
    needed: shoesNeeded,
    weatherTier: tripTier,
    hasRain,
    reason: packTripText(lang, isHot ? "shoesReasonHot" : "shoesReasonCool", { needed: shoesNeeded }),
    fromWardrobe: shoeMatches,
    ...shoeGaps,
  });

  if (hasRain) {
    result.push({
      category: "rainGear",
      icon: "cloud-rain",
      needed: 1,
      weatherTier: tripTier,
      hasRain,
      reason: packTripText(lang, "rainReason"),
      fromWardrobe: outer.filter((i) =>
        i.tags?.includes("waterproof") || i.name.toLowerCase().includes("rain")
      ).slice(0, 1),
      needToBuy: [],
    });
  }

  if (stylingPreferences.hijabPreference === "always") {
    const hijabsNeeded = Math.min(3, Math.max(1, Math.ceil(days / 3)));
    const hijabMatches = hijabs.slice(0, hijabsNeeded);
    result.push({
      category: "cat_accessories",
      icon: "circle",
      needed: hijabsNeeded,
      weatherTier: tripTier,
      hasRain,
      reason: lang === "ru" ? "Хиджаб обязателен для каждого образа; количество рассчитано с учётом повторного использования." : lang === "uz" ? "Har bir obraz uchun hijob kerak; miqdor qayta kiyishni hisobga oladi." : "A hijab is required for every look; this quantity allows practical re-wear.",
      fromWardrobe: hijabMatches,
      needToBuy: [],
      missingCount: Math.max(0, hijabsNeeded - hijabMatches.length),
    });
  }

  if (access.length > 0) {
    result.push({
      category: "weatherAccessories",
      icon: "circle",
      needed: Math.min(access.length, 3),
      reason: hasRain
        ? packTripText(lang, "rainAccessoriesReason")
        : tripTier === "warm" || tripTier === "hot"
          ? packTripText(lang, "sunAccessoriesReason")
          : packTripText(lang, "tempAccessoriesReason"),
      weatherTier: tripTier,
      hasRain,
      fromWardrobe: access.slice(0, 3),
      needToBuy: [],
    });
  }

  return result;
}

// ─────────────────────────────────────────────
// Calendar helpers
// ─────────────────────────────────────────────
function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function buildCalendarWeeks(year: number, month: number): (Date | null)[][] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const padStart = (first.getDay() + 6) % 7; // Monday-first
  const days: (Date | null)[] = Array(padStart).fill(null);
  for (let d = 1; d <= last.getDate(); d++) days.push(new Date(year, month, d));
  while (days.length % 7 !== 0) days.push(null);
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks;
}

function formatDate(d: Date | null, lang: Language): string {
  if (!d) return "";
  return d.toLocaleDateString(packTripLocale(lang), { day: "numeric", month: "short", year: "numeric" });
}

function dayDiff(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86400000);
}

// ─────────────────────────────────────────────
// DateRangePicker component
// ─────────────────────────────────────────────
interface DateRangePickerProps {
  start: Date | null;
  end: Date | null;
  onChange: (start: Date | null, end: Date | null) => void;
  colors: ReturnType<typeof useColors>;
  lang: Language;
}

function DateRangePicker({ start, end, onChange, colors, lang }: DateRangePickerProps) {
  const today = startOfDay(new Date());
  const [open, setOpen] = useState(false);
  const [calMonth, setCalMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const weeks = buildCalendarWeeks(calMonth.getFullYear(), calMonth.getMonth());

  const handleDayPress = (day: Date) => {
    const d = startOfDay(day);
    if (d < today) return; // no past dates
    if (!start || (start && end)) {
      // reset or start fresh
      onChange(d, null);
    } else {
      // second tap
      if (d < start) {
        onChange(d, start);
      } else if (sameDay(d, start)) {
        onChange(null, null);
      } else {
        onChange(start, d);
      }
    }
  };

  const prevMonth = () => setCalMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  const nextMonth = () => setCalMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));

  const dayStyle = (day: Date | null) => {
    if (!day) return {};
    const d = startOfDay(day);
    const isStart = start && sameDay(d, start);
    const isEnd = end && sameDay(d, end);
    const inRange = start && end && d > start && d < end;
    const isPast = d < today;
    return { isStart, isEnd, inRange, isPast, isToday: sameDay(d, today) };
  };

  const locale = packTripLocale(lang);
  const monthLabel = calMonth.toLocaleDateString(locale, { month: "long", year: "numeric" });
  const weekdays = Array.from({ length: 7 }, (_, index) =>
    new Date(2024, 0, 1 + index).toLocaleDateString(locale, { weekday: "short" }),
  );

  return (
    <View>
      {/* Two tap targets: departure / return */}
      <View style={drStyles.row}>
        <TouchableOpacity
          onPress={() => setOpen((v) => !v)}
          style={[drStyles.dateBtn, { backgroundColor: colors.secondary, borderColor: start ? colors.accent : colors.border }]}
        >
          <Feather name="calendar" size={14} color={start ? colors.accent : colors.mutedForeground} />
          <View style={{ flex: 1 }}>
            <Text style={[drStyles.dateBtnLabel, { color: colors.mutedForeground }]}>{packTripText(lang, "departure")}</Text>
            <Text style={[drStyles.dateBtnValue, { color: start ? colors.foreground : colors.mutedForeground }]}>
              {start ? formatDate(start, lang) : packTripText(lang, "selectDate")}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={[drStyles.arrow, { backgroundColor: colors.border }]}>
          <Feather name="arrow-right" size={12} color={colors.mutedForeground} />
        </View>

        <TouchableOpacity
          onPress={() => setOpen((v) => !v)}
          style={[drStyles.dateBtn, { backgroundColor: colors.secondary, borderColor: end ? colors.accent : colors.border }]}
        >
          <Feather name="calendar" size={14} color={end ? colors.accent : colors.mutedForeground} />
          <View style={{ flex: 1 }}>
            <Text style={[drStyles.dateBtnLabel, { color: colors.mutedForeground }]}>{packTripText(lang, "returnDate")}</Text>
            <Text style={[drStyles.dateBtnValue, { color: end ? colors.foreground : colors.mutedForeground }]}>
              {end ? formatDate(end, lang) : packTripText(lang, "selectDate")}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {start && !end && (
        <Text style={[drStyles.hint, { color: colors.accent }]}>{packTripText(lang, "tapReturn")}</Text>
      )}
      {start && end && (
        <Text style={[drStyles.hint, { color: colors.mutedForeground }]}>
          {packTripText(lang, "nightsChange", { count: dayDiff(start, end), nights: packTripCountWord(lang, dayDiff(start, end), "night") })}
        </Text>
      )}

      {open && (
        <View style={[drStyles.calendar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Month navigation */}
          <View style={drStyles.calHeader}>
            <TouchableOpacity onPress={prevMonth} style={drStyles.navBtn}>
              <Feather name="chevron-left" size={18} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={[drStyles.monthLabel, { color: colors.foreground }]}>{monthLabel}</Text>
            <TouchableOpacity onPress={nextMonth} style={drStyles.navBtn}>
              <Feather name="chevron-right" size={18} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          {/* Weekday headers */}
          <View style={drStyles.weekRow}>
            {weekdays.map((w) => (
              <Text key={w} style={[drStyles.weekday, { color: colors.mutedForeground }]}>{w}</Text>
            ))}
          </View>

          {/* Day grid */}
          {weeks.map((week, wi) => (
            <View key={wi} style={drStyles.weekRow}>
              {week.map((day, di) => {
                if (!day) return <View key={di} style={drStyles.dayCell} />;
                const { isStart, isEnd, inRange, isPast, isToday } = dayStyle(day);
                const filled = isStart || isEnd;
                return (
                  <TouchableOpacity
                    key={di}
                    onPress={() => handleDayPress(day)}
                    disabled={isPast}
                    style={[
                      drStyles.dayCell,
                      inRange && { backgroundColor: colors.accent + "22" },
                      filled && { backgroundColor: colors.accent, borderRadius: 20 },
                      isToday && !filled && { borderWidth: 1.5, borderColor: colors.accent, borderRadius: 20 },
                    ]}
                  >
                    <Text style={[
                      drStyles.dayText,
                      { color: isPast ? colors.border : colors.foreground },
                      filled && { color: colors.card, fontWeight: "700" },
                    ]}>
                      {day.getDate()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}

          {start && end && (
            <TouchableOpacity onPress={() => { setOpen(false); }} style={[drStyles.doneBtn, { backgroundColor: colors.primary }]}>
              <Text style={[drStyles.doneBtnText, { color: colors.primaryForeground }]}>{packTripText(lang, "done")}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const drStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  dateBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dateBtnLabel: { fontSize: 9, fontWeight: "700", letterSpacing: 0.8 },
  dateBtnValue: { fontSize: 13, fontWeight: "600", marginTop: 1 },
  arrow: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: "center", justifyContent: "center",
  },
  hint: { fontSize: 12, textAlign: "center", marginTop: 6 },
  calendar: {
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    gap: 4,
  },
  calHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  navBtn: { padding: 6 },
  monthLabel: { fontSize: 15, fontWeight: "700" },
  weekRow: { flexDirection: "row" },
  weekday: { flex: 1, textAlign: "center", fontSize: 11, fontWeight: "600", paddingVertical: 4 },
  dayCell: {
    flex: 1,
    // A square based on the full desktop width turns into a giant calendar on web.
    // Keep compact fixed-height rows there; native keeps roomy touch targets.
    ...(Platform.OS === "web" ? { height: 38 } : { aspectRatio: 1 }),
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 1,
  },
  dayText: { fontSize: 13 },
  doneBtn: { marginTop: 8, paddingVertical: 10, borderRadius: 12, alignItems: "center" },
  doneBtnText: { fontSize: 14, fontWeight: "700" },
});

// ─────────────────────────────────────────────
// Pack item card — wardrobe grid visual standard
// ─────────────────────────────────────────────
function PackItemCard({
  item,
  checked,
  onToggle,
  weatherReason,
}: {
  item: ClothingItem;
  checked: boolean;
  onToggle: () => void;
  weatherReason: string;
}) {
  const colors = useColors();
  const tone = getGarmentTone(item.colorHex, colors.border);
  const { t } = useLanguage();
  const categoryLabel = t(`cat_${item.category}`);
  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => [
        pkStyles.card,
        { backgroundColor: tone.background, borderColor: tone.border, shadowColor: colors.foreground, opacity: pressed ? 0.88 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
      ]}
    >
      {/* Image zone */}
      <View style={[pkStyles.imageZone, { backgroundColor: tone.background }]}>
        {item.imageUri ? (
          <Image
            source={{ uri: item.imageUri }}
            style={pkStyles.image}
            contentFit="contain"
            transition={250}
          />
        ) : (
          <View style={[pkStyles.noImage, { backgroundColor: tone.stronger }]}>
            <Feather name="shopping-bag" size={24} color="#C8B9AE" />
          </View>
        )}
        {/* Check badge — top right, toggleable */}
        <View style={[pkStyles.checkBadge, checked ? pkStyles.checkBadgeOn : pkStyles.checkBadgeOff]}>
          <Feather name="check" size={11} color={checked ? colors.card : "#C8B9AE"} />
        </View>
      </View>

      {/* Info strip */}
      <View style={pkStyles.info}>
        <Text style={[pkStyles.name, { color: colors.foreground }]} numberOfLines={1}>{item.name}</Text>
        <View style={pkStyles.metaRow}>
          <View style={[pkStyles.swatch, { backgroundColor: item.colorHex }]} />
          <Text style={[pkStyles.metaText, { color: colors.mutedForeground }]} numberOfLines={1}>{categoryLabel}</Text>
        </View>
        <Text style={[pkStyles.weatherReason, { color: colors.mutedForeground }]}>{weatherReason}</Text>
      </View>
    </Pressable>
  );
}

const pkStyles = StyleSheet.create({
  card: {
    width: 112,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#EAEAEA",
    overflow: "hidden",
    shadowColor: "#1C1512",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  imageZone: {
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  image: { width: "100%", height: "100%" },
  noImage: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  checkBadge: {
    position: "absolute",
    top: 7,
    right: 7,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  checkBadgeOn: { backgroundColor: "#059669" },
  checkBadgeOff: {
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
  },
  // The explanation is part of the recommendation, not decorative text.
  // Reserve space so it can wrap naturally on narrow screens.
  info: { padding: 8, gap: 4, minHeight: 78 },
  name: { fontSize: 12, fontWeight: "700", color: "#1C1512", letterSpacing: 0.1 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  swatch: {
    width: 9,
    height: 9,
    borderRadius: 5,
    flexShrink: 0,
    borderWidth: 0.5,
    borderColor: "rgba(0,0,0,0.08)",
  },
  metaText: { fontSize: 10, fontWeight: "500", color: "#78716C" },
  weatherReason: { fontSize: 9, lineHeight: 12, fontWeight: "500", color: "#78716C" },
});

// ─────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────
export default function PackTripScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { items: wardrobe } = useWardrobe();
  const { gender, stylingPreferences, setStylingPreferences } = useUserProfile();
  const { t, lang } = useLanguage();
  const topPad = getTopPadding(insets.top);

  // Destination input + suggestions
  const [city, setCity] = useState("");
  const [suggestions, setSuggestions] = useState<GeoSuggestion[]>([]);
  const [selectedGeo, setSelectedGeo] = useState<GeoSuggestion | null>(null);
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Date range
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  const tripDays = startDate && endDate ? Math.max(1, dayDiff(startDate, endDate)) : null;

  // Results
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forecasts, setForecasts] = useState<DailyForecast[] | null>(null);
  const [packingList, setPackingList] = useState<PackingCategory[] | null>(null);
  const [resolvedCity, setResolvedCity] = useState("");
  const [usesClimateEstimate, setUsesClimateEstimate] = useState(false);

  // ── Autocomplete ──
  useEffect(() => {
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    if (city.length < 2 || selectedGeo) { setSuggestions([]); return; }
    suggestTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=6&language=${lang}&format=json`
        );
        const data = await res.json() as { results?: GeoSuggestion[] };
        setSuggestions(data.results ?? []);
      } catch { setSuggestions([]); }
    }, 380);
    return () => { if (suggestTimer.current) clearTimeout(suggestTimer.current); };
  }, [city, selectedGeo, lang]);

  const selectSuggestion = (s: GeoSuggestion) => {
    setSelectedGeo(s);
    setCity(formatGeoLabel(s));
    setSuggestions([]);
  };

  const handleCityChange = (v: string) => {
    setCity(v);
    setSelectedGeo(null);
    setError(null);
  };

  // ── Generate ──
  const handleGenerate = async () => {
    if (!city.trim()) { setError(packTripText(lang, "enterCity")); return; }
    if (!startDate || !endDate) { setError(packTripText(lang, "selectDates")); return; }
    if (tripDays === null || tripDays < 1) { setError(packTripText(lang, "invalidDates")); return; }

    setError(null);
    setIsLoading(true);
    setForecasts(null);
    setPackingList(null);
    setUsesClimateEstimate(false);

    try {
      let geo = selectedGeo;
      if (!geo) {
        const geoRes = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city.trim())}&count=1&language=${lang}&format=json`
        );
        const geoData = await geoRes.json() as { results?: GeoSuggestion[] };
        if (!geoData.results?.length) { setError(packTripText(lang, "cityNotFound", { city: city.trim() })); return; }
        geo = geoData.results[0]!;
      }

      setResolvedCity(formatGeoLabel(geo));

      // Format dates for API
      const fmt = (d: Date) => d.toISOString().split("T")[0];
      const today = startOfDay(new Date());
      const apiStart = startDate < today ? today : startDate;
      const apiEnd = new Date(apiStart.getTime() + Math.min(tripDays, 16) * 86400000);
      // A trip that ends outside the live forecast window must use climate
      // averages, even when its departure date is still inside that window.
      const isFutureForecast = dayDiff(today, endDate) > 16;
      setUsesClimateEstimate(isFutureForecast);

      let parsed: DailyForecast[] = [];

      if (!isFutureForecast) {
        const forecastRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${geo.latitude}&longitude=${geo.longitude}` +
          `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto` +
          `&start_date=${fmt(apiStart)}&end_date=${fmt(apiEnd)}`
        );
        const forecastData = await forecastRes.json() as {
          daily: { time: string[]; temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_sum: number[] };
        };
        const d = forecastData.daily;
        parsed = d.time.map((date, i) => ({
          date,
          tempMax: d.temperature_2m_max[i]!,
          tempMin: d.temperature_2m_min[i]!,
          precipitation: d.precipitation_sum[i]!,
        }));
      } else {
        // Trip is beyond 16-day window — use climate data
        const clRes = await fetch(
          `https://climate-api.open-meteo.com/v1/climate?latitude=${geo.latitude}&longitude=${geo.longitude}` +
          `&start_date=${fmt(startDate).slice(0, 4)}-${fmt(startDate).slice(5, 7)}-01` +
          `&end_date=${fmt(startDate).slice(0, 4)}-${fmt(startDate).slice(5, 7)}-28` +
          `&models=EC_Earth3P_HR&daily=temperature_2m_max,temperature_2m_min`
        ).catch(() => null);
        if (clRes && clRes.ok) {
          const clData = await clRes.json() as {
            daily?: { time: string[]; temperature_2m_max: number[]; temperature_2m_min: number[] };
          };
          if (clData.daily) {
            const cl = clData.daily;
            const avgMax = cl.temperature_2m_max.reduce((a, b) => a + b, 0) / cl.temperature_2m_max.length;
            const avgMin = cl.temperature_2m_min.reduce((a, b) => a + b, 0) / cl.temperature_2m_min.length;
            for (let i = 0; i < Math.min(tripDays, 16); i++) {
              const d = new Date(startDate.getTime() + i * 86400000);
              parsed.push({ date: fmt(d), tempMax: avgMax, tempMin: avgMin, precipitation: 0 });
            }
          }
        }
        // If climate API failed, use generic seasonal mock
        if (parsed.length === 0) {
          const month = startDate.getMonth();
          const [mockMax, mockMin] = month < 2 || month > 10 ? [5, -2] : month < 5 ? [18, 8] : month < 9 ? [30, 18] : [14, 6];
          for (let i = 0; i < Math.min(tripDays, 16); i++) {
            const d = new Date(startDate.getTime() + i * 86400000);
            parsed.push({ date: fmt(d), tempMax: mockMax, tempMin: mockMin, precipitation: 0 });
          }
        }
      }

      // One isolated shower on a longer trip should not make every suggestion
      // sound like rain gear. Short trips still treat a single wet day seriously.
      const rainyDays = parsed.filter((d) => d.precipitation > 1).length;
      const rainThreshold = parsed.length <= 2 ? 1 : Math.max(2, Math.ceil(parsed.length * 0.35));
      const hasRain = rainyDays >= rainThreshold;
      setForecasts(parsed);
      setPackingList(generatePackingList(tripDays, parsed, wardrobe, hasRain, lang, gender, stylingPreferences));
    } catch {
      setError(packTripText(lang, "weatherError"));
    } finally {
      setIsLoading(false);
    }
  };

  const avgHigh = forecasts ? Math.round(forecasts.reduce((s, d) => s + d.tempMax, 0) / forecasts.length) : null;
  const avgLow = forecasts ? Math.round(forecasts.reduce((s, d) => s + d.tempMin, 0) / forecasts.length) : null;
  const dominantTier = avgHigh != null && avgLow != null ? getTier((avgHigh + avgLow) / 2) : null;
  const totalPacked = packingList?.reduce((s, c) => s + c.fromWardrobe.length, 0) ?? 0;
  const totalToBuy = packingList?.reduce((s, c) => s + c.needToBuy.length, 0) ?? 0;

  // Checked item state — all items start checked; tapping toggles
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (packingList) {
      const allIds = packingList.flatMap((c) => c.fromWardrobe.map((i) => i.id));
      setCheckedItems(new Set(allIds));
    }
  }, [packingList]);

  const toggleChecked = (id: string) => {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const rebuildPackingList = (preferences: StylingPreferences) => {
    if (!forecasts || !tripDays) return;
    const rainyDays = forecasts.filter((day) => day.precipitation > 1).length;
    const rainThreshold = forecasts.length <= 2 ? 1 : Math.max(2, Math.ceil(forecasts.length * 0.35));
    setPackingList(generatePackingList(
      tripDays,
      forecasts,
      wardrobe,
      rainyDays >= rainThreshold,
      lang,
      gender,
      preferences,
    ));
  };

  const excludeShopType = async (type: ShopSuggestionType) => {
    if (stylingPreferences.excludedShopTypes.includes(type)) return;
    const next = {
      ...stylingPreferences,
      excludedShopTypes: [...stylingPreferences.excludedShopTypes, type],
    };
    await setStylingPreferences(next);
    rebuildPackingList(next);
  };

  const restoreShopType = async (type: ShopSuggestionType) => {
    const next = {
      ...stylingPreferences,
      excludedShopTypes: stylingPreferences.excludedShopTypes.filter((value) => value !== type),
    };
    await setStylingPreferences(next);
    rebuildPackingList(next);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 16, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.replace("/(tabs)")}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.headerLabel, { color: colors.mutedForeground }]}>{packTripText(lang, "packingUtility")}</Text>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t("pack_trip")}</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: getBottomPadding(insets.bottom, 80) }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Input card ── */}
        <View style={[styles.inputCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.inputTitle, { color: colors.foreground }]}>{packTripText(lang, "whereGoing")}</Text>
          <Text style={[styles.inputSub, { color: colors.mutedForeground }]}>
            {packTripText(lang, "intro")}
          </Text>

          {/* Destination with autocomplete */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{packTripText(lang, "destination")}</Text>
            <View style={[styles.inputRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <Feather name="map-pin" size={16} color={colors.mutedForeground} />
              <TextInput
                style={[styles.textInput, { color: colors.foreground }]}
                value={city}
                onChangeText={handleCityChange}
                placeholder={packTripText(lang, "destinationPlaceholder")}
                placeholderTextColor={colors.mutedForeground}
                returnKeyType="search"
                autoCorrect={false}
                autoCapitalize="words"
              />
              {city.length > 0 && (
                <TouchableOpacity onPress={() => { setCity(""); setSelectedGeo(null); setSuggestions([]); }}>
                  <Feather name="x" size={15} color={colors.mutedForeground} />
                </TouchableOpacity>
              )}
            </View>

            {suggestions.length > 0 && (
              <View style={[styles.suggestionBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {suggestions.map((s, i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => selectSuggestion(s)}
                    style={[
                      styles.suggestionRow,
                      i < suggestions.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                    ]}
                  >
                    <Feather name="map-pin" size={13} color={colors.accent} style={{ marginTop: 1 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.suggCityText, { color: colors.foreground }]}>{s.name}</Text>
                      <Text style={[styles.suggSubText, { color: colors.mutedForeground }]}>
                        {formatGeoRegion(s)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Date range picker */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{packTripText(lang, "travelDates")}</Text>
            <DateRangePicker
              start={startDate}
              end={endDate}
              onChange={(s, e) => { setStartDate(s); setEndDate(e); }}
              colors={colors}
              lang={lang}
            />
          </View>

          {error && (
            <View style={styles.errorRow}>
              <Feather name="alert-circle" size={14} color={colors.destructive} />
              <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            onPress={handleGenerate}
            disabled={isLoading || !city.trim() || !startDate || !endDate}
            style={[styles.generateBtn, {
              backgroundColor: colors.primary,
              opacity: (isLoading || !city.trim() || !startDate || !endDate) ? 0.5 : 1,
            }]}
          >
            {isLoading
              ? <ActivityIndicator size="small" color={colors.primaryForeground} />
              : <Feather name="zap" size={16} color={colors.primaryForeground} />
            }
            <Text style={[styles.generateBtnText, { color: colors.primaryForeground }]}>
              {isLoading
                ? packTripText(lang, "checkingForecast")
                : tripDays
                  ? packTripText(lang, "packForNights", { count: tripDays, nights: packTripCountWord(lang, tripDays, "night") })
                  : packTripText(lang, "generateList")}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Forecast summary ── */}
        {forecasts && dominantTier && (
          <View style={[styles.forecastCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {usesClimateEstimate && (
              <View style={[styles.forecastNotice, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                <Feather name="info" size={16} color={colors.accent} />
                <Text style={[styles.forecastNoticeText, { color: colors.foreground }]}>
                  {packTripText(lang, "forecastLimitNotice")}
                </Text>
              </View>
            )}
            <View style={styles.forecastHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.forecastCity, { color: colors.foreground }]}>{resolvedCity}</Text>
                <Text style={[styles.forecastRange, { color: colors.mutedForeground }]}>
                  {avgLow}° – {avgHigh}°C {packTripText(lang, "average")} · {forecasts.length} {packTripCountWord(lang, forecasts.length, "day")} {packTripText(lang, usesClimateEstimate ? "seasonalEstimate" : "forecast")}
                  {tripDays ? ` · ${tripDays} ${packTripCountWord(lang, tripDays, "night")}` : ""}
                </Text>
              </View>
              <View style={[styles.tierBadge, { backgroundColor: colors.accent + "22" }]}>
                <Text style={[styles.tierText, { color: colors.accent }]}>
                  {packTripText(lang, TIER_NAME_KEY[dominantTier])}
                </Text>
              </View>
            </View>
            <Text style={[styles.tierDesc, { color: colors.mutedForeground }]}>{packTripText(lang, TIER_DESC_KEY[dominantTier])}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.forecastStrip}>
              {forecasts.slice(0, 7).map((d) => (
                <View key={d.date} style={[styles.forecastDay, { backgroundColor: colors.secondary }]}>
                  <Text style={[styles.forecastDayName, { color: colors.mutedForeground }]}>
                    {new Date(d.date + "T00:00:00").toLocaleDateString(packTripLocale(lang), { weekday: "short" })}
                  </Text>
                  <Text style={[styles.forecastHigh, { color: colors.foreground }]}>{Math.round(d.tempMax)}°</Text>
                  <Text style={[styles.forecastLow, { color: colors.mutedForeground }]}>{Math.round(d.tempMin)}°</Text>
                  {d.precipitation > 1 && <Feather name="cloud-rain" size={10} color="#3B82F6" />}
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Packing list ── */}
        {packingList && (
          <>
            {stylingPreferences.excludedShopTypes.length > 0 && (
              <View style={[styles.hiddenTypesCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.hiddenTypesTitle, { color: colors.foreground }]}>Not suggesting</Text>
                <Text style={[styles.hiddenTypesHint, { color: colors.mutedForeground }]}>Tap a type to allow it again.</Text>
                <View style={styles.hiddenTypesRow}>
                  {stylingPreferences.excludedShopTypes.map((type) => (
                    <TouchableOpacity
                      key={type}
                      onPress={() => void restoreShopType(type)}
                      style={[styles.hiddenTypeChip, { backgroundColor: colors.secondary, borderColor: colors.border }]}
                    >
                      <Text style={[styles.hiddenTypeText, { color: colors.foreground }]}>{shopSuggestionTypeLabel(type)}</Text>
                      <Feather name="x" size={12} color={colors.mutedForeground} />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
            <View style={styles.packSummaryRow}>
              <View style={[styles.packStat, { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" }]}>
                <Text style={[styles.packStatNum, { color: "#059669" }]}>{totalPacked}</Text>
                <Text style={[styles.packStatLabel, { color: "#059669" }]}>{packTripText(lang, "fromWardrobeStat")}</Text>
              </View>
              {totalToBuy > 0 && (
                <View style={[styles.packStat, { backgroundColor: "#FEF9EC", borderColor: "#FDE68A" }]}>
                  <Text style={[styles.packStatNum, { color: "#D97706" }]}>{totalToBuy}</Text>
                  <Text style={[styles.packStatLabel, { color: "#D97706" }]}>{packTripText(lang, "considerBuying")}</Text>
                </View>
              )}
            </View>

            {packingList.map((cat) => (
              <View key={cat.category} style={[styles.packCat, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.packCatHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.packCatTitle, { color: colors.foreground }]}>
                      {cat.category.startsWith("cat_") ? t(cat.category) : packTripText(lang, cat.category as "rainGear" | "weatherAccessories")}
                    </Text>
                    <Text style={[styles.packCatReason, { color: colors.mutedForeground }]}>{cat.reason}</Text>
                  </View>
                  <View style={[styles.neededBadge, { backgroundColor: colors.secondary }]}>
                    <Text style={[styles.neededNum, { color: colors.foreground }]}>{cat.needed}</Text>
                  </View>
                </View>

                {cat.fromWardrobe.length > 0 && (
                  <View style={styles.wardrobeCarousel}>
                    <Text style={[styles.matchesLabel, { color: colors.mutedForeground }]}>{packTripText(lang, "fromWardrobe")}</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.carouselRow}
                    >
                      {cat.fromWardrobe.map((item) => (
                        <PackItemCard
                          key={item.id}
                          item={item}
                          checked={checkedItems.has(item.id)}
                          onToggle={() => toggleChecked(item.id)}
                          weatherReason={wardrobeWeatherReason(item, cat.weatherTier, cat.hasRain, lang)}
                        />
                      ))}
                    </ScrollView>
                  </View>
                )}

                {/* ── Consider packing — image cards ── */}
                {cat.needToBuy.length > 0 && (
                  <View style={styles.toBuySection}>
                    <Text style={[styles.matchesLabel, { color: "#D97706" }]}>{packTripText(lang, "considerPacking")}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.buyCardRow}>
                      {cat.needToBuy.map((item) => (
                        <View
                          key={item.id}
                          style={[styles.buyCard, { backgroundColor: colors.secondary, borderColor: "#FDE68A" }]}
                        >
                          <Pressable
                            accessibilityRole="link"
                            accessibilityLabel={packTripText(lang, "viewProduct", { name: packTripProductName(lang, item.id, item.name), store: item.store })}
                            onPress={() => { void Linking.openURL(item.productUrl); }}
                          >
                            <Image
                              source={{ uri: item.imageUrl }}
                              style={styles.buyCardImg}
                              contentFit="cover"
                              transition={200}
                            />
                            <View style={styles.buyCardLabel}>
                              <Feather name="shopping-bag" size={10} color="#D97706" />
                              <View style={styles.buyCardCopy}>
                                <Text style={styles.buyCardText} numberOfLines={2}>{packTripProductName(lang, item.id, item.name)}</Text>
                                <Text style={styles.buyCardMeta}>{item.store} · {item.priceUz.toLocaleString(packTripLocale(lang))} UZS</Text>
                                <Text style={styles.buyCardReason}>{item.weatherReason}</Text>
                              </View>
                            </View>
                          </Pressable>
                          <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityLabel={`Don't suggest ${shopSuggestionTypeLabel(getShopSuggestionType(item.name))}`}
                            onPress={() => void excludeShopType(getShopSuggestionType(item.name))}
                            style={styles.hideTypeButton}
                          >
                            <Feather name="slash" size={11} color="#92400E" />
                            <Text style={styles.hideTypeButtonText}>Don't suggest this type</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {Boolean(cat.missingCount) && (
                  <View style={[styles.errorRow, { marginTop: 10 }]}>
                    <Feather name="alert-circle" size={14} color="#DC2626" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.errorText}>{packTripText(lang, "stillNeeded", { count: cat.missingCount ?? 0 })}</Text>
                      <Text style={[styles.packCatReason, { color: colors.mutedForeground }]}>{packTripText(lang, "stillNeededHint")}</Text>
                    </View>
                  </View>
                )}

              </View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 18,
    paddingBottom: 16, borderBottomWidth: 1,
  },
  headerLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 1.2 },
  headerTitle: { fontSize: 22, fontWeight: "700" },
  content: { paddingHorizontal: 18, paddingTop: 16, gap: 16 },
  inputCard: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 16 },
  inputTitle: { fontSize: 18, fontWeight: "700" },
  inputSub: { fontSize: 13, lineHeight: 18, marginTop: -8 },
  fieldGroup: { gap: 8 },
  fieldLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.8 },
  inputRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11,
  },
  textInput: { flex: 1, fontSize: 15, fontWeight: "500" },
  suggestionBox: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    marginTop: -4,
  },
  suggestionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  suggCityText: { fontSize: 14, fontWeight: "600" },
  suggSubText: { fontSize: 12, marginTop: 1 },
  errorRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  errorText: { color: "#DC2626", fontSize: 13 },
  generateBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 14, borderRadius: 14,
  },
  generateBtnText: { fontSize: 15, fontWeight: "700" },
  forecastCard: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 12 },
  forecastNotice: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderWidth: 1, borderRadius: 12, padding: 12 },
  forecastNoticeText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: "500" },
  forecastHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  forecastCity: { fontSize: 18, fontWeight: "700" },
  forecastRange: { fontSize: 13, marginTop: 2 },
  tierBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, flexShrink: 0 },
  tierText: { fontSize: 12, fontWeight: "700" },
  tierDesc: { fontSize: 12, lineHeight: 17 },
  forecastStrip: { gap: 8 },
  forecastDay: {
    alignItems: "center", gap: 3,
    paddingHorizontal: 10, paddingVertical: 10, borderRadius: 12, minWidth: 52,
  },
  forecastDayName: { fontSize: 10, fontWeight: "600" },
  forecastHigh: { fontSize: 16, fontWeight: "800" },
  forecastLow: { fontSize: 12 },
  packSummaryRow: { flexDirection: "row", gap: 10 },
  hiddenTypesCard: { borderRadius: 14, borderWidth: 1, padding: 12, gap: 7 },
  hiddenTypesTitle: { fontSize: 13, fontWeight: "700" },
  hiddenTypesHint: { fontSize: 11 },
  hiddenTypesRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  hiddenTypeChip: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6 },
  hiddenTypeText: { fontSize: 11, fontWeight: "600" },
  packStat: { flex: 1, alignItems: "center", padding: 14, borderRadius: 14, borderWidth: 1, gap: 2 },
  packStatNum: { fontSize: 26, fontWeight: "800" },
  packStatLabel: { fontSize: 11, fontWeight: "600" },
  packCat: { borderRadius: 18, borderWidth: 1, padding: 14, gap: 12 },
  packCatHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  packCatTitle: { fontSize: 15, fontWeight: "700" },
  packCatReason: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  neededBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  neededNum: { fontSize: 14, fontWeight: "800" },
  wardrobeCarousel: { gap: 10 },
  matchesLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.8 },
  carouselRow: { gap: 10, paddingBottom: 4 },
  toBuySection: { gap: 8 },
  buyCardRow: { gap: 10, paddingBottom: 4 },
  buyCard: {
    width: 130,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1.5,
  },
  buyCardImg: { width: 130, height: 160 },
  buyCardLabel: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 5,
    padding: 10,
    minHeight: 112,
  },
  buyCardCopy: { flex: 1, gap: 3 },
  buyCardText: { flex: 1, fontSize: 11, fontWeight: "600", color: "#92400E", lineHeight: 15 },
  buyCardReason: { fontSize: 10, lineHeight: 14, fontWeight: "600", color: "#7C5A35", marginTop: 2 },
  buyCardMeta: { fontSize: 9, fontWeight: "500", color: "#A16207" },
  hideTypeButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, borderTopWidth: 1, borderTopColor: "#FDE68A", paddingHorizontal: 8, paddingVertical: 9 },
  hideTypeButtonText: { fontSize: 9, fontWeight: "700", color: "#92400E" },
});
