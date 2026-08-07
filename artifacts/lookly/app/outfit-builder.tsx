import { Feather } from "@/components/FeatherIcon";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { SvgXml } from "react-native-svg";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
  type ViewStyle,
} from "react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getTopPadding, getBottomPadding } from "@/constants/layout";
import { getApiBase } from "@/constants/api";
import { apiAuthHeaders } from "@/lib/apiAuth";
import { useColors } from "@/hooks/useColors";
import {
  type ClothingCategory,
  type ClothingItem,
  type OutfitItemKey,
  type OutfitItems,
  type Season,
  useWardrobe,
} from "@/contexts/WardrobeContext";
import { useSocial } from "@/contexts/SocialContext";
import { useWeather } from "@/contexts/WeatherContext";
import { type Gender, type StylingPreferences, useUserProfile } from "@/contexts/UserProfileContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { enforceExclusiveBase } from "@/lib/outfitComposition";
import { getProfileCategoryOptions } from "@/lib/profileCategories";
import { getOutfitModestyIssues, isAutomaticItemEligible, isHijabItem } from "@/lib/modestyRules";
import { getGarmentTone } from "@/lib/garmentTone";
import { ClothingCategoryIcon } from "@/components/ClothingCategoryIcon";

type BaseOutfitSlotKey = "outerwear" | "tops" | "bottoms" | "dresses" | "shoes" | "socks" | "accessories";
type OutfitSlotKey = BaseOutfitSlotKey | `accessories:${string}`;

function getCurrentSeason(): Season {
  const m = new Date().getMonth();
  if (m >= 2 && m <= 4) return "spring";
  if (m >= 5 && m <= 7) return "summer";
  if (m >= 8 && m <= 10) return "fall";
  return "winter";
}

function isLight(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}

function categoryToSlotKey(cat: ClothingCategory): BaseOutfitSlotKey {
  return cat as BaseOutfitSlotKey;
}

function isAccessorySlot(slotKey: string): boolean {
  return slotKey === "accessories" || slotKey.startsWith("accessories:");
}

function buildAssignedOutfit(items: ClothingItem[]): OutfitItems {
  const next: OutfitItems = {};
  for (const item of items) {
    const key: OutfitItemKey = item.category === "accessories" ? `accessories:${item.id}` : categoryToSlotKey(item.category);
    next[key] = item;
  }
  return next;
}

const API_BASE = getApiBase();

function decodeSvgPreview(base64: string): string {
  try {
    return globalThis.atob(base64);
  } catch {
    return "";
  }
}

function isSvgPreview(value: string): boolean {
  return value.startsWith("data:image/svg+xml") || value.trimStart().startsWith("PHN2Zy");
}

function previewSource(value: string): string {
  return value.startsWith("data:") ? value : `data:image/png;base64,${value}`;
}

async function imageUriToReference(uri?: string): Promise<{ imageBase64: string; imageMime: string } | null> {
  if (!uri) return null;
  if (uri.startsWith("data:")) {
    const [header, imageBase64 = ""] = uri.split(",", 2);
    const imageMime = header.match(/^data:([^;]+)/)?.[1] ?? "image/png";
    return imageBase64 ? { imageBase64, imageMime } : null;
  }
  try {
    const response = await fetch(uri);
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = "";
    for (let index = 0; index < bytes.length; index += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    }
    return {
      imageBase64: globalThis.btoa(binary),
      imageMime: response.headers.get("content-type")?.split(";")[0] || "image/png",
    };
  } catch {
    return null;
  }
}

// ─── Combo fingerprint ───────────────────────────────────────────────────────
function makeComboKey(assigned: OutfitItems): string {
  return Object.values(assigned)
    .filter(Boolean)
    .map((i) => i!.id)
    .sort()
    .join("|");
}

// ─── Climate compatibility utilities ─────────────────────────────────────────

/** Returns true if footwear is open-toe / sandal-type (inappropriate in cool weather). */
function isSummerOnlyShoe(item: ClothingItem): boolean {
  const n = item.name.toLowerCase();
  const tags = item.tags.map((t) => t.toLowerCase());
  const warmSeasonsOnly =
    item.seasons.length > 0 &&
    !item.seasons.includes("fall") &&
    !item.seasons.includes("winter");
  return (
    n.includes("sandal") ||
    n.includes("flip flop") ||
    n.includes("flip-flop") ||
    n.includes("slide") ||
    n.includes("open toe") ||
    n.includes("open-toe") ||
    n.includes("slipper") ||
    n.includes("espadrille") ||
    tags.some((t) =>
      ["sandals", "open-toe", "flip-flops", "slides", "summer-only", "open_toe"].includes(t)
    ) ||
    warmSeasonsOnly
  );
}

/** Minimum temperature (°C) at which open-toe/sandal footwear is acceptable. */
const SANDAL_TEMP_MIN = 22;

/**
 * Cross-category climate coherence check.
 * Called once per attempt inside localSmartFill to reject illogical combos
 * before they ever reach the canvas.
 */
function isClimateCompatible(
  combo: Partial<Record<OutfitSlotKey, ClothingItem>>,
  temperature: number
): boolean {
  const shoes = combo["shoes"];

  if (shoes && isSummerOnlyShoe(shoes)) {
    // Gate 1: temperature must be warm enough for open-toe footwear
    if (temperature < SANDAL_TEMP_MIN) return false;

    // Gate 2: no heavy tops or outerwear paired with sandals
    for (const key of ["tops", "outerwear"] as OutfitSlotKey[]) {
      const piece = combo[key];
      if (!piece) continue;
      if (piece.fabricWeight === "heavy") return false;
      // Item is tagged for fall/winter only → incompatible with sandals
      if (
        piece.seasons.length > 0 &&
        !piece.seasons.includes("summer") &&
        !piece.seasons.includes("spring")
      )
        return false;
    }

    // Gate 3: sandals + formal/workwear bottoms → incoherent
    const bottom = combo["bottoms"] ?? combo["dresses"];
    if (bottom?.isWorkwear) return false;

    // Gate 4: medium-weight outerwear at cool temp still wrong with sandals
    const outer = combo["outerwear"];
    if (outer && temperature < 26) return false;
  }

  // Gate 5: heavy outerwear + summer-only bottoms → incoherent even without sandals
  const outer = combo["outerwear"];
  if (outer?.fabricWeight === "heavy") {
    const bottom = combo["bottoms"] ?? combo["dresses"];
    if (
      bottom &&
      bottom.seasons.length > 0 &&
      !bottom.seasons.includes("fall") &&
      !bottom.seasons.includes("winter")
    )
      return false;
  }

  return true;
}

// ─── Stable-stylist color & wear utilities ────────────────────────────────────

/** True if a hex color is a low-saturation neutral (white, black, grey, beige, taupe…) */
function isNeutralColor(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? true : (max - min) / max < 0.22;
}

/**
 * Weighted pick biased toward frequently-worn items + neutral tones.
 * Worn count contributes up to 6× weight; neutrals get an extra 2× bonus.
 * This is the "AI Suggestions / Reliable Stylist" pick strategy.
 */
function weightedPickStable(pool: ClothingItem[]): ClothingItem | null {
  if (pool.length === 0) return null;
  const weighted: ClothingItem[] = [];
  for (const item of pool) {
    const wornWeight = Math.max(1, Math.min(item.timesWorn ?? 0, 6));
    const neutralBonus = isNeutralColor(item.colorHex) ? 2 : 1;
    for (let k = 0; k < wornWeight * neutralBonus; k++) weighted.push(item);
  }
  return weighted[Math.floor(Math.random() * weighted.length)] ?? null;
}

// ─── Local smart fill ────────────────────────────────────────────────────────
// mode "fill-empty"  → only touches slots that are currently empty AND unlocked
// mode "reshuffle"   → replaces every unlocked slot with a fresh pick
// strategy "stable"  → favours high-timesWorn + neutral-toned items (AI Suggestions)
// strategy "creative"→ pure random from the climate-safe pool
// Each attempt is validated for cross-category climate coherence via
// isClimateCompatible before being accepted or recorded.
function localSmartFill(
  currentAssigned: Partial<Record<OutfitSlotKey, ClothingItem>>,
  allItems: ClothingItem[],
  lockedSlots: Set<OutfitSlotKey>,
  temperature: number,
  sessionCombos: Set<string>,
  mode: "fill-empty" | "reshuffle",
  strategy: "stable" | "creative" = "stable",
  stylingPreferences?: StylingPreferences,
  maxAttempts = 40
): Partial<Record<OutfitSlotKey, ClothingItem>> {
  const season = getCurrentSeason();
  const isHot = temperature > 26;
  const isCold = temperature < 12;
  const isCool = temperature < SANDAL_TEMP_MIN;
  const FILL_CATS: ClothingCategory[] = [
    "tops", "bottoms", "outerwear", "dresses", "shoes", "accessories",
  ];
  const hasDressLocked = lockedSlots.has("dresses");

  const getPool = (cat: ClothingCategory): ClothingItem[] => {
    let pool = allItems.filter((i) => {
      if (i.category !== cat) return false;
      if (!isAutomaticItemEligible(i, stylingPreferences)) return false;
      if (isHot && i.fabricWeight === "heavy") return false;
      if (isCold && i.fabricWeight === "light") return false;
      // Pre-filter: remove sandals/open-toe shoes when temperature is below threshold
      if (cat === "shoes" && isCool && isSummerOnlyShoe(i)) return false;
      return true;
    });
    // Fallback: relax fabric constraint but keep sandal ban if cool
    if (pool.length === 0 && stylingPreferences?.hijabPreference !== "always") {
      pool = allItems.filter(
        (i) =>
          i.category === cat &&
          !(cat === "shoes" && isCool && isSummerOnlyShoe(i))
      );
    }
    // Last resort: full category pool
    if (pool.length === 0 && stylingPreferences?.hijabPreference !== "always") pool = allItems.filter((i) => i.category === cat);

    if (cat === "accessories" && stylingPreferences?.hijabPreference === "always") {
      pool = pool.filter(isHijabItem);
    }

    const seasonPool = pool.filter((i) => i.seasons.includes(season));
    return seasonPool.length > 0 ? seasonPool : pool;
  };

  let lastClimateValid: Partial<Record<OutfitSlotKey, ClothingItem>> | null = null;
  let lastAttempt: Partial<Record<OutfitSlotKey, ClothingItem>> = { ...currentAssigned };

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const next: Partial<Record<OutfitSlotKey, ClothingItem>> = { ...currentAssigned };

    for (const cat of FILL_CATS) {
      const slotKey = categoryToSlotKey(cat);
      if (lockedSlots.has(slotKey)) continue;
      if (mode === "fill-empty" && next[slotKey] !== undefined) continue;
      // Skip outerwear if hot; skip tops/bottoms if a dress is locked
      if (cat === "outerwear" && isHot) continue;
      if ((cat === "tops" || cat === "bottoms") && hasDressLocked) continue;
      if (cat === "dresses" && (lockedSlots.has("tops") || lockedSlots.has("bottoms"))) continue;

      const pool = getPool(cat);
      if (pool.length === 0) continue;

      // For reshuffles: prefer a different item than what's currently in this slot
      let candidates = pool;
      if (mode === "reshuffle" && currentAssigned[slotKey]) {
        const others = pool.filter((i) => i.id !== currentAssigned[slotKey]!.id);
        if (others.length > 0) candidates = others;
      }

      const picked =
        strategy === "stable"
          ? weightedPickStable(candidates)
          : candidates[Math.floor(Math.random() * candidates.length)] ?? null;
      if (picked) next[slotKey] = picked;
    }

    // Socks are never required. In cool weather Lookly may add a pair only
    // when the selected footwear is closed-toe; in warm weather it leaves the
    // slot empty unless the person explicitly adds socks themselves.
    if (!lockedSlots.has("socks") && !(mode === "fill-empty" && next.socks)) {
      const socksPool = getPool("socks");
      const closedShoes = next.shoes && !isSummerOnlyShoe(next.shoes);
      const includeSocks = Boolean(closedShoes) && (isCold || (isCool && Math.random() < 0.55));
      if (includeSocks && socksPool.length > 0) {
        const pickedSocks = strategy === "stable" ? weightedPickStable(socksPool) : socksPool[Math.floor(Math.random() * socksPool.length)];
        if (pickedSocks) next.socks = pickedSocks;
      } else {
        delete next.socks;
      }
    }

    // One-piece and separates are mutually exclusive. Respect the user's
    // locked base, otherwise prefer the one-piece selected in this attempt.
    const exclusiveNext = enforceExclusiveBase(next, lockedSlots);
    lastAttempt = exclusiveNext;

    // ── Climate coherence audit ──────────────────────────────────────────
    if (!isClimateCompatible(exclusiveNext, temperature)) continue; // bad combo — retry

    // Track the best climate-valid result so far for the fallback
    if (!lastClimateValid) lastClimateValid = exclusiveNext;

    // Deduplicate: only return if this combo hasn't been shown in this session
    if (!sessionCombos.has(makeComboKey(exclusiveNext))) return exclusiveNext;
  }

  // Exhausted all attempts — return best climate-valid result, or last attempt
  return lastClimateValid ?? lastAttempt;
}

async function generateOutfitPreview(
  items: ClothingItem[],
  weather: string,
  temperature: number,
  userBodyPhotoBase64?: string | null,
  userBodyPhotoMime?: string,
  userGender?: string | null,
  userAge?: number | null,
  stylingPreferences?: StylingPreferences,
): Promise<string> {
  const itemImages = (await Promise.all(items.map((item) => imageUriToReference(item.imageUri))))
    .filter((image): image is { imageBase64: string; imageMime: string } => !!image);
  const body = {
    items: items.map((i) => ({
      name: i.name,
      color: i.color,
      colorHex: i.colorHex,
      category: i.category,
      visualSignature: i.visualSignature,
    })),
    weather,
    temperature,
    userBodyPhotoBase64: userBodyPhotoBase64 ?? undefined,
    userBodyPhotoMime: userBodyPhotoBase64 ? (userBodyPhotoMime ?? "image/jpeg") : undefined,
    userGender: userGender ?? undefined,
    userAge: userAge ?? undefined,
    stylingPreferences,
    itemImages,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 80_000);
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/outfit-preview`, {
      method: "POST",
      headers: await apiAuthHeaders(),
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("AI preview took too long. Image generation may be unavailable right now. Please try again later.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    let errMsg = `Preview unavailable (${res.status})`;
    try {
      const errBody = await res.json() as { error?: string };
      if (errBody.error) errMsg = errBody.error;
    } catch {}
    throw new Error(errMsg);
  }
  const data = await res.json() as { image: string; mimeType?: string };
  return `data:${data.mimeType || "image/png"};base64,${data.image}`;
}

interface DraggableItemProps {
  item: ClothingItem;
  isAssigned: boolean;
  onTap: () => void;
}

function DraggableItem({ item, isAssigned, onTap }: DraggableItemProps) {
  const colors = useColors();
  const tone = getGarmentTone(item.colorHex, colors.border);
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: isAssigned ? 0.5 : 1,
  }));

  const handlePress = () => {
    if (!isAssigned) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      scale.value = withSpring(1.12, { damping: 10 }, () => {
        scale.value = withSpring(1);
      });
    }
    onTap();
  };

  return (
    <Pressable
      onPress={handlePress}
      style={styles.draggableWrap}
    >
      <Animated.View style={animStyle}>
        <View style={[styles.itemCard, { backgroundColor: tone.background, borderWidth: 1, borderColor: tone.border }]}>
          {item.imageUri ? (
            <Image
              source={{ uri: item.imageUri }}
              style={StyleSheet.absoluteFillObject}
              contentFit="contain"
            />
          ) : (
            <View style={styles.itemCardNoImage}>
              <Feather name="shopping-bag" size={22} color="#C8B9AE" />
            </View>
          )}
          {isAssigned && (
            <View style={[styles.assignedOverlay, { backgroundColor: "rgba(28,21,18,0.18)" }]}>
              <Feather name="check" size={18} color={colors.primaryForeground} />
            </View>
          )}
        </View>
        <Text
          style={[styles.itemCardName, { color: colors.foreground }]}
          numberOfLines={1}
        >
          {item.name}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

// FILTER_CATEGORIES is built inside the component using t() — see below

type AssignedOutfit = OutfitItems;

function getOutfitPieceLayout(
  slotKey: OutfitSlotKey,
  assigned: AssignedOutfit,
  isWideScreen: boolean,
): ViewStyle {
  const hasLayeredUpperBody = !!assigned.outerwear && !!assigned.tops;
  const accessoryIndex = isAccessorySlot(slotKey)
    ? Object.entries(assigned)
        .filter(([, item]) => item?.category === "accessories")
        .findIndex(([key]) => key === slotKey)
    : -1;

  // Accessories are the only repeatable canvas category. Arrange them on the
  // side rails in pairs so a bag, belt, jewellery, hijab, etc. remain visible.
  if (accessoryIndex >= 0) {
    const row = Math.floor(accessoryIndex / 2);
    const onRight = accessoryIndex % 2 === 1;
    return isWideScreen
      ? { top: 142 + row * 92, ...(onRight ? { right: "14%" } : { left: "14%" }), width: "15%", height: 84, zIndex: 4 }
      : { top: 126 + row * 84, ...(onRight ? { right: "3%" } : { left: "3%" }), width: "20%", height: 76, zIndex: 4 };
  }

  if (isWideScreen) {
    switch (slotKey) {
      case "outerwear":
        return hasLayeredUpperBody
          ? { top: 8, left: "17%", width: "29%", height: 150, zIndex: 1 }
          : { top: 8, left: "31%", width: "38%", height: 150, zIndex: 2 };
      case "tops":
        return hasLayeredUpperBody
          ? { top: 8, right: "17%", width: "29%", height: 150, zIndex: 2 }
          : { top: 8, left: "31%", width: "38%", height: 150, zIndex: 2 };
      case "dresses":
        return { top: 8, left: "32%", width: "36%", height: 300, zIndex: 2 };
      case "bottoms":
        return { top: 166, left: "37%", width: "26%", height: 184, zIndex: 3 };
      case "shoes":
        return { top: 354, left: "40%", width: "20%", height: 72, zIndex: 4 };
      case "socks":
        return { top: 226, right: "20%", width: "14%", height: 82, zIndex: 4 };
      case "accessories":
        return {};
    }
  }

  switch (slotKey) {
    case "outerwear":
      return hasLayeredUpperBody
        ? { top: 6, left: "8%", width: "38%", height: 132, zIndex: 1 }
        : { top: 6, left: "25%", width: "50%", height: 142, zIndex: 2 };
    case "tops":
      return hasLayeredUpperBody
        ? { top: 6, right: "8%", width: "38%", height: 132, zIndex: 2 }
        : { top: 6, left: "25%", width: "50%", height: 142, zIndex: 2 };
    case "dresses":
      return { top: 6, left: "27%", width: "46%", height: 270, zIndex: 2 };
    case "bottoms":
      return { top: 150, left: "34%", width: "32%", height: 166, zIndex: 3 };
    case "shoes":
      return { top: 318, left: "38%", width: "24%", height: 62, zIndex: 4 };
    case "socks":
      return { top: 206, right: "5%", width: "20%", height: 76, zIndex: 4 };
    case "accessories":
      return {};
  }
  return {};
}

const CATEGORY_SWATCH_COLORS: Record<ClothingCategory, string> = {
  outerwear: "#8B7665",
  tops: "#D8D0C3",
  bottoms: "#B9BAA9",
  dresses: "#77706A",
  shoes: "#A5623D",
  socks: "#C9BBAA",
  accessories: "#3D3E3A",
};

interface OutfitPieceProps {
  slotKey: OutfitSlotKey;
  item: ClothingItem;
  gender: Gender | null;
  isLocked: boolean;
  layout: ViewStyle;
  onClear: () => void;
}

function OutfitPiece({ slotKey: _slotKey, item, gender, isLocked, layout, onClear }: OutfitPieceProps) {
  const colors = useColors();
  const tone = getGarmentTone(item.colorHex, colors.border);

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`Remove ${item.name} from look`}
      activeOpacity={0.82}
      onPress={onClear}
      style={[styles.lookPiece, layout]}
    >
      {item.imageUri ? (
        <Image source={{ uri: item.imageUri }} style={styles.lookPieceImage} contentFit="contain" />
      ) : (
        <View style={[styles.lookPieceFallback, { backgroundColor: tone.background, borderColor: tone.border }]}>
          <ClothingCategoryIcon category={item.category} gender={gender} size={30} color={colors.mutedForeground} />
        </View>
      )}
      <View style={[styles.lookPieceControl, { backgroundColor: colors.card }]}>
        <Feather name={isLocked ? "lock" : "x"} size={9} color={colors.foreground} />
      </View>
    </TouchableOpacity>
  );
}

interface CategorySwatchProps {
  category: ClothingCategory;
  label: string;
  item?: ClothingItem;
  gender: Gender | null;
  active: boolean;
  wide?: boolean;
  onPress: () => void;
}

function CategorySwatch({ category, label, item, gender, active, wide, onPress }: CategorySwatchProps) {
  const colors = useColors();
  const baseColor = CATEGORY_SWATCH_COLORS[category];
  const tone = item ? getGarmentTone(item.colorHex, colors.border) : null;
  const backgroundColor = tone?.background ?? baseColor;
  const borderColor = tone?.border ?? baseColor;
  const foregroundColor = tone ? colors.foreground : isLight(baseColor) ? "#4B433E" : "#FFFFFF";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.categorySwatch,
        wide && styles.categorySwatchWide,
        { backgroundColor, borderColor, opacity: pressed ? 0.82 : 1 },
        active && styles.categorySwatchActive,
      ]}
    >
      <View style={styles.categorySwatchVisual}>
        {item?.imageUri ? (
          <Image source={{ uri: item.imageUri }} style={styles.categorySwatchImage} contentFit="contain" />
        ) : (
          <ClothingCategoryIcon category={category} gender={gender} size={31} color={foregroundColor} />
        )}
      </View>
      <Text style={[styles.categorySwatchLabel, { color: foregroundColor }]} numberOfLines={1}>
        {label}
      </Text>
      {active ? (
        <View style={[styles.categorySwatchActiveBadge, { backgroundColor: colors.accent }]}>
          <Feather name="check" size={9} color={colors.primaryForeground} />
        </View>
      ) : null}
    </Pressable>
  );
}

export default function OutfitBuilderScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { items, saveOutfit, savedOutfits, isLoading: isWardrobeLoading } = useWardrobe();
  const { addLook } = useSocial();
  const { condition, temperature, weatherCode } = useWeather();
  const { bodyPhotoUri, bodyPhotoBase64, bodyPhotoMime, gender, age, stylingPreferences } = useUserProfile();
  const { t, lang } = useLanguage();
  const { width: windowWidth } = useWindowDimensions();
  const isWideScreen = windowWidth >= 900;

  const FILTER_CATEGORIES: { key: "all" | ClothingCategory; label: string }[] = [
    { key: "all", label: t("cat_all") },
    ...getProfileCategoryOptions(gender, lang, t),
  ];

  const topPad = getTopPadding(insets.top);

  const [assigned, setAssigned] = useState<AssignedOutfit>({});
  const [lockedSlots, setLockedSlots] = useState<Set<OutfitSlotKey>>(new Set());
  const sessionCombos = useRef<Set<string>>(new Set());

  // ── Canvas micro-fade on reshuffle ──────────────────────────────────────────
  // Fades the entire outfit canvas to near-zero opacity (90 ms), lets React
  // commit the new slot assignments in that gap, then fades back to full (210 ms).
  // Since this runs on the Reanimated UI thread, state setters are dispatched
  // via runOnJS so they execute on the JS thread at the right moment.
  const canvasOpacity = useSharedValue(1);
  const canvasAnimStyle = useAnimatedStyle(() => ({ opacity: canvasOpacity.value }));
  const fadeSwapCanvas = useCallback(
    (apply: () => void) => {
      canvasOpacity.value = withTiming(0.08, { duration: 90 }, (finished) => {
        if (finished) {
          runOnJS(apply)();
          canvasOpacity.value = withTiming(1, { duration: 210 });
        }
      });
    },
    [canvasOpacity]
  );
  const [hasDoneAuto, setHasDoneAuto] = useState(false);
  const [filterCat, setFilterCat] = useState<"all" | ClothingCategory>("all");

  useEffect(() => {
    if (filterCat !== "all" || items.length === 0) return;
    const firstAvailable = (["tops", "dresses", "bottoms", "outerwear", "shoes", "accessories", "socks"] as ClothingCategory[])
      .find((category) => items.some((item) => item.category === category));
    if (firstAvailable) setFilterCat(firstAvailable);
  }, [filterCat, items]);

  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [useBodyReference, setUseBodyReference] = useState(true);
  const [previewProgressStage, setPreviewProgressStage] = useState(0);
  const previewCache = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    if (!isGenerating) {
      setPreviewProgressStage(0);
      return;
    }
    setPreviewProgressStage(0);
    const generatingTimer = setTimeout(() => setPreviewProgressStage(1), 6_000);
    const finishingTimer = setTimeout(() => setPreviewProgressStage(2), 18_000);
    return () => {
      clearTimeout(generatingTimer);
      clearTimeout(finishingTimer);
    };
  }, [isGenerating]);

  const [showSaveModal, setShowSaveModal] = useState(false);
  const [outfitName, setOutfitName] = useState("");

  const [showSavedOutfits, setShowSavedOutfits] = useState(false);
  const [isAutoLoading, setIsAutoLoading] = useState(false);
  const [autoWeatherNote, setAutoWeatherNote] = useState<string | null>(null);

  const { anchorItemId, outfitItemIds, preview } = useLocalSearchParams<{
    anchorItemId?: string;
    outfitItemIds?: string;
    preview?: string;
  }>();
  const anchorFired = useRef(false);
  const outfitIdeaFired = useRef(false);
  const pendingPreviewPieces = useRef<ClothingItem[] | null>(null);

  useEffect(() => {
    if (!outfitItemIds || outfitIdeaFired.current || items.length === 0) return;
    outfitIdeaFired.current = true;
    const selected = outfitItemIds
      .split(",")
      .map((id) => items.find((item) => item.id === id))
      .filter((item): item is ClothingItem => !!item);
    if (selected.length === 0) return;
    const next = buildAssignedOutfit(selected);
    pendingPreviewPieces.current = selected;
    setAssigned(next);
    const selectedSlots = Object.keys(next) as OutfitSlotKey[];
    if (selected.some((item) => item.category === "accessories")) selectedSlots.push("accessories");
    setLockedSlots(new Set(selectedSlots));
    setHasDoneAuto(true);
    if (preview === "true") setTimeout(() => void handleGeneratePreview(), 120);
  });

  useEffect(() => {
    if (anchorItemId && !anchorFired.current && items.length > 0) {
      anchorFired.current = true;
      const anchor = items.find((i) => i.id === anchorItemId);
      if (anchor) {
        const slotKey: OutfitSlotKey = anchor.category === "accessories"
          ? `accessories:${anchor.id}`
          : categoryToSlotKey(anchor.category);
        setAssigned({ [slotKey]: anchor });
        setLockedSlots(new Set(anchor.category === "accessories" ? [slotKey, "accessories"] : [slotKey]));
        setTimeout(() => void handleAutoSuggest(), 100);
      }
    }
  });

  const assignItem = useCallback((item: ClothingItem) => {
    setPreviewImage(null);
    setAssigned((prev) => {
      const existingEntry = Object.entries(prev).find(([, selected]) => selected?.id === item.id);
      // Toggle off: the exact same item was tapped again.
      if (existingEntry) {
        const next = { ...prev };
        delete next[existingEntry[0] as OutfitSlotKey];
        setLockedSlots((slots) => {
          const updated = new Set(slots);
          updated.delete(existingEntry[0] as OutfitSlotKey);
          if (item.category === "accessories" && !Object.values(next).some((selected) => selected?.category === "accessories")) {
            updated.delete("accessories");
          }
          return updated;
        });
        return next;
      }
      const slotKey: OutfitSlotKey = item.category === "accessories"
        ? `accessories:${item.id}`
        : categoryToSlotKey(item.category);
      // Accessories are additive. Other garment categories still replace the
      // existing item in their single visual slot.
      setLockedSlots((slots) => {
        const updated = new Set([...slots, slotKey]);
        if (item.category === "accessories") updated.add("accessories");
        return updated;
      });
      const next = { ...prev, [slotKey]: item };
      sessionCombos.current.add(makeComboKey(next));
      return next;
    });
  }, []);

  const clearSlot = useCallback((slotKey: OutfitSlotKey) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPreviewImage(null);
    setAssigned((prev) => {
      const next = { ...prev };
      delete next[slotKey];
      setLockedSlots((slots) => {
        const updated = new Set(slots);
        updated.delete(slotKey);
        if (isAccessorySlot(slotKey)) {
          const stillHasAccessories = Object.values(next).some((item) => item?.category === "accessories");
          if (stillHasAccessories) updated.add("accessories");
          else updated.delete("accessories");
        }
        return updated;
      });
      return next;
    });
  }, []);

  const handleAutoSuggest = async () => {
    if (isAutoLoading) return;
    const selectedAccessories = Object.values(assigned).filter((item): item is ClothingItem => item?.category === "accessories");
    if (stylingPreferences.hijabPreference === "always" && selectedAccessories.length > 0 && !selectedAccessories.some(isHijabItem)) {
      Alert.alert("Hijab needed", "Unlock or replace the current accessory so Lookly can include your hijab.");
      return;
    }
    setIsAutoLoading(true);
    setAutoWeatherNote(null);

    // ── RESHUFFLE PATH: local-only, instant, never repeats ─────────────────
    if (hasDoneAuto) {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const next = localSmartFill(
          assigned, items, lockedSlots, temperature,
          sessionCombos.current, "reshuffle", "stable", stylingPreferences
        );
        sessionCombos.current.add(makeComboKey(next));
        fadeSwapCanvas(() => { setPreviewImage(null); setAssigned(next); });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } finally {
        setIsAutoLoading(false);
      }
      return;
    }

    // ── FIRST-TIME PATH: try AI API, fall back to local ────────────────────
    try {
      const res = await fetch(`${API_BASE}/suggest-outfits`, {
        method: "POST",
        headers: await apiAuthHeaders(),
        body: JSON.stringify({
          items: items.map((i) => ({
            id: i.id,
            name: i.name,
            color: i.color,
            colorHex: i.colorHex,
            category: i.category,
            seasons: i.seasons,
            tags: i.tags ?? [],
            fabricWeight: i.fabricWeight,
            visualSignature: i.visualSignature,
          })),
          weather: condition,
          condition,
          weatherCode,
          temperature,
          userGender: gender ?? undefined,
          userAge: age ?? undefined,
          stylingPreferences,
          lockedIds: [...lockedSlots]
            .map((k) => assigned[k]?.id)
            .filter((id): id is string => !!id),
        }),
      });

      const data = await res.json() as {
        outfits: { name: string; mood: string; weatherNote?: string | null; items: { itemId: string; role: string }[] }[];
        incomplete?: boolean;
        message?: string;
      };
      const outfitList = (data.outfits ?? []).filter((o) => o.items.length > 0);
      if (outfitList.length === 0 && data.incomplete) {
        setAutoWeatherNote(data.message ?? t("hijab_add_item"));
        return;
      }
      if (outfitList.length === 0) throw new Error("no outfits");

      // The API's incomplete response contains one deterministic "safest"
      // partial outfit. Reusing that response made Auto always show the same
      // top and bottom (and often only those two pieces). Keep its weather
      // warning, but let the local stylist rotate through the wardrobe so the
      // result is visibly different when alternatives are available.
      if (data.incomplete) {
        const next = localSmartFill(
          assigned, items, lockedSlots, temperature,
          sessionCombos.current, "reshuffle", "stable", stylingPreferences
        );
        sessionCombos.current.add(makeComboKey(next));
        setHasDoneAuto(true);
        setPreviewImage(null);
        setAssigned(next);
        setAutoWeatherNote(data.message ?? null);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return;
      }

      // Pick a combo that hasn't been seen in this session
      const unseenOutfit = outfitList.find((o) => {
        const proposed = { ...assigned };
        const itemMap = new Map(items.map((i) => [i.id, i]));
        for (const slot of o.items) {
          const item = itemMap.get(slot.itemId);
          if (!item) continue;
          const slotKey = categoryToSlotKey(item.category);
          if (!lockedSlots.has(slotKey)) proposed[slotKey] = item;
        }
        return !sessionCombos.current.has(makeComboKey(proposed));
      }) ?? outfitList[0]!;

      const itemMap = new Map(items.map((i) => [i.id, i]));
      const next = { ...assigned };
      for (const slot of unseenOutfit.items) {
        const item = itemMap.get(slot.itemId);
        if (!item) continue;
        const slotKey = categoryToSlotKey(item.category);
        if (lockedSlots.has(slotKey)) continue;
        next[slotKey] = item;
      }
      sessionCombos.current.add(makeComboKey(next));
      setHasDoneAuto(true);
      setPreviewImage(null);
      setAssigned(next);
      if (unseenOutfit.weatherNote) setAutoWeatherNote(unseenOutfit.weatherNote);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      // Local fallback — weather-aware, season-aware, deduped
      if (stylingPreferences.hijabPreference === "always" && !items.some(isHijabItem)) {
        setAutoWeatherNote(t("hijab_add_item"));
        return;
      }
      const next = localSmartFill(
        assigned, items, lockedSlots, temperature,
        sessionCombos.current, "reshuffle", "stable", stylingPreferences
      );
      sessionCombos.current.add(makeComboKey(next));
      setHasDoneAuto(true);
      setPreviewImage(null);
      setAssigned(next);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally {
      setIsAutoLoading(false);
    }
  };

  const handleClearAll = () => {
    setAssigned({});
    setPreviewImage(null);
    setLockedSlots(new Set());
    setHasDoneAuto(false);
    sessionCombos.current.clear();
  };

  const handleGeneratePreview = async (forceRegenerate = false) => {
    const pieces = pendingPreviewPieces.current ?? (Object.values(assigned).filter(Boolean) as ClothingItem[]);
    pendingPreviewPieces.current = null;
    if (pieces.length === 0) {
      Alert.alert("No items selected", "Add at least one item to preview the look.");
      return;
    }
    const modestyIssues = getOutfitModestyIssues(pieces, stylingPreferences);
    if (modestyIssues.length > 0) {
      const message = modestyIssues.includes("HIJAB_REQUIRED")
        ? t("hijab_add_item")
        : "This look does not match your current coverage settings. Adjust the items or your preferences in Profile.";
      Alert.alert("Coverage check", message);
      return;
    }
    const bodyReferenceEnabled = useBodyReference && !!bodyPhotoBase64;
    const previewKey = JSON.stringify({
      pieces: pieces
        .map((piece) => [piece.id, piece.imageUri ?? "", piece.imageProcessingVersion ?? 0])
        .sort(([left], [right]) => String(left).localeCompare(String(right))),
      condition,
      temperature: Math.round(temperature),
      bodyReferenceEnabled,
      bodyReference: bodyReferenceEnabled ? bodyPhotoUri : null,
      gender,
      age,
      stylingPreferences,
    });
    const cachedPreview = previewCache.current.get(previewKey);
    if (cachedPreview && !forceRegenerate) {
      setPreviewImage(cachedPreview);
      setShowPreview(true);
      return;
    }
    setPreviewError(null);
    setIsGenerating(true);
    setShowPreview(true);
    try {
      const img = await generateOutfitPreview(
        pieces,
        condition,
        temperature,
        bodyReferenceEnabled ? bodyPhotoBase64 : null,
        bodyPhotoMime,
        gender,
        age,
        stylingPreferences,
      );
      if (previewCache.current.size >= 6) {
        const oldestKey = previewCache.current.keys().next().value;
        if (oldestKey) previewCache.current.delete(oldestKey);
      }
      previewCache.current.set(previewKey, img);
      setPreviewImage(img);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not generate the look preview. Please try again.";
      setPreviewError(msg);
      setShowPreview(false);
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePost = async () => {
    const pieces = Object.values(assigned).filter(Boolean) as ClothingItem[];
    if (pieces.length === 0) {
      Alert.alert("Empty look", "Add at least one item to your look first.");
      return;
    }
    const itemNames = pieces.map((i) => i.name).join(", ");
    await addLook({
      userId: "me",
      userName: "You",
      userHandle: "my.lookly",
      caption: `My outfit: ${itemNames}`,
      weather: condition,
      temperature,
      tags: ["ootd", "mylook"],
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace("/(tabs)/looks");
  };

  const handleSaveOutfit = async () => {
    if (!outfitName.trim()) return;
    await saveOutfit(outfitName.trim(), assigned, previewImage ?? undefined);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowSaveModal(false);
    setOutfitName("");
    Alert.alert("Saved!", `"${outfitName.trim()}" added to your outfit templates.`);
  };

  const handleLoadSavedOutfit = (outfit: (typeof savedOutfits)[number]) => {
    setAssigned(outfit.items);
    const savedSlots = Object.keys(outfit.items) as OutfitSlotKey[];
    if (Object.values(outfit.items).some((item) => item?.category === "accessories")) savedSlots.push("accessories");
    setLockedSlots(new Set(savedSlots));
    setHasDoneAuto(true);
    if (outfit.previewImage) {
      setPreviewImage(outfit.previewImage);
      setShowSavedOutfits(false);
      setShowPreview(true);
    } else {
      setPreviewImage(null);
      setShowSavedOutfits(false);
    }
  };

  const filteredItems =
    filterCat === "all" ? items : items.filter((i) => i.category === filterCat);

  const assignedIds = new Set(
    Object.values(assigned)
      .filter(Boolean)
      .map((i) => i!.id)
  );
  const pieceCount = Object.keys(assigned).length;
  const swatchCategories = FILTER_CATEGORIES.filter(
    (category): category is { key: ClothingCategory; label: string } => category.key !== "all"
  );
  const lookEntries = (Object.entries(assigned) as [OutfitSlotKey, ClothingItem | undefined][])
    .filter((entry): entry is [OutfitSlotKey, ClothingItem] => !!entry[1]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: topPad + 16,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity onPress={() => router.replace("/(tabs)/wardrobe")}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t("make_your_look")}</Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
            {pieceCount === 0
              ? t("ob_tap_to_build")
              : `${pieceCount} ${t(pieceCount === 1 ? "ob_piece" : "ob_pieces")} ${t("ob_selected")}`}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => setShowSavedOutfits(true)}
          style={[styles.savedBtn, { backgroundColor: colors.secondary }]}
        >
          <Feather name="bookmark" size={14} color={colors.accent} />
          {savedOutfits.length > 0 && (
            <Text style={[styles.savedBadge, { color: colors.accent }]}>{savedOutfits.length}</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: getBottomPadding(insets.bottom, 80) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[styles.canvas, isWideScreen && styles.canvasWide, canvasAnimStyle]}>
          <View style={styles.canvasLabelRow}>
            <Text style={[styles.canvasLabel, { color: colors.mutedForeground }]}>
              {t("ob_outfit_canvas")}
            </Text>
            <View style={[styles.weatherChip, { backgroundColor: colors.secondary }]}>
              <Text style={[styles.weatherChipText, { color: colors.mutedForeground }]}>
                {temperature}°C · {condition}
              </Text>
            </View>
          </View>
          {autoWeatherNote ? (
            <View style={[styles.weatherNoteRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <Feather name="cloud" size={12} color={colors.accent} />
              <Text style={[styles.weatherNoteText, { color: colors.foreground }]} numberOfLines={2}>
                {autoWeatherNote}
              </Text>
            </View>
          ) : null}

          <View style={[styles.lookCard, { backgroundColor: colors.background }]}>
            <View style={styles.lookCardTopRow}>
              <TouchableOpacity
                onPress={handleAutoSuggest}
                disabled={isAutoLoading}
                style={[styles.reshuffleBtn, { opacity: isAutoLoading ? 0.55 : 1 }]}
              >
                {isAutoLoading ? (
                  <ActivityIndicator size="small" color={colors.accent} style={{ width: 15, height: 15 }} />
                ) : (
                  <Feather name={hasDoneAuto ? "refresh-cw" : "zap"} size={15} color={colors.accent} />
                )}
                <Text style={[styles.reshuffleText, { color: colors.foreground }]}>
                  {isAutoLoading ? t("ob_styling") : hasDoneAuto ? t("ob_reshuffle") : t("ob_auto")}
                </Text>
              </TouchableOpacity>
            </View>

            <View
              style={[
                styles.lookStage,
                isWideScreen && styles.lookStageWide,
                { backgroundColor: colors.secondary },
              ]}
            >
              {lookEntries.length > 0 ? (
                lookEntries.map(([slotKey, item]) => (
                  <OutfitPiece
                    key={slotKey}
                    slotKey={slotKey}
                    item={item}
                    gender={gender}
                    isLocked={lockedSlots.has(slotKey)}
                    layout={getOutfitPieceLayout(slotKey, assigned, isWideScreen)}
                    onClear={() => clearSlot(slotKey)}
                  />
                ))
              ) : (
                <View style={styles.lookStageEmpty}>
                  <View style={[styles.lookStageEmptyIcon, { backgroundColor: colors.secondary }]}>
                    <Feather name="plus" size={22} color={colors.accent} />
                  </View>
                </View>
              )}
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[
                styles.categorySwatches,
                isWideScreen && styles.categorySwatchesWide,
              ]}
            >
              {swatchCategories.map((category) => {
                const categoryItems = items.filter((item) => item.category === category.key);
                const swatchItem = Object.values(assigned).find((item) => item?.category === category.key) ?? categoryItems[0];
                return (
                  <CategorySwatch
                    key={category.key}
                    category={category.key}
                    label={category.label}
                    item={swatchItem}
                    gender={gender}
                    active={filterCat === category.key}
                    wide={isWideScreen}
                    onPress={() => setFilterCat(category.key)}
                  />
                );
              })}
            </ScrollView>
          </View>

          {bodyPhotoBase64 ? (
            <View style={[styles.previewReferenceOption, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.previewReferenceTitle, { color: colors.foreground }]}>{t("ob_use_body_reference")}</Text>
                <Text style={[styles.previewReferenceHint, { color: colors.mutedForeground }]}>{t("ob_body_reference_priority")}</Text>
              </View>
              <Switch
                accessibilityLabel={t("ob_use_body_reference")}
                value={useBodyReference}
                onValueChange={(value) => {
                  setUseBodyReference(value);
                  setPreviewImage(null);
                  setPreviewError(null);
                }}
                trackColor={{ false: colors.border, true: colors.accent }}
                thumbColor={colors.card}
              />
            </View>
          ) : null}

          <TouchableOpacity
            onPress={() => handleGeneratePreview(false)}
            disabled={pieceCount === 0 || isGenerating}
            style={[
              styles.previewBtn,
              {
                backgroundColor: pieceCount > 0 ? colors.accent : colors.secondary,
              },
            ]}
          >
            {isGenerating ? (
              <ActivityIndicator size="small" color={colors.card} />
            ) : (
              <Feather
                name={previewImage ? "image" : "eye"}
                size={16}
                color={pieceCount > 0 ? colors.card : colors.mutedForeground}
              />
            )}
            <Text
              style={[
                styles.previewBtnText,
                { color: pieceCount > 0 ? colors.card : colors.mutedForeground },
              ]}
            >
              {isGenerating
                ? t("ob_generating")
                : previewImage
                ? t("ob_view_look")
                : t("ob_preview_on_model")}
            </Text>
          </TouchableOpacity>

          {previewError ? (
            <View style={styles.previewError}>
              <Text style={styles.previewErrorTitle}>Preview unavailable</Text>
              <Text style={styles.previewErrorText}>{previewError}</Text>
            </View>
          ) : null}

          <View style={styles.canvasActions}>
            <TouchableOpacity
              onPress={handleClearAll}
              style={[styles.actionBtn, { borderColor: colors.border }]}
            >
              <Feather name="trash-2" size={14} color={colors.mutedForeground} />
              <Text style={[styles.actionBtnText, { color: colors.mutedForeground }]}>{t("ob_clear")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                if (pieceCount === 0) return;
                const ids = (Object.values(assigned).filter(Boolean) as ClothingItem[]).map((i) => i.id);
                router.push(
                  `/calendar?itemIds=${encodeURIComponent(JSON.stringify(ids))}${previewImage ? `&previewImage=${encodeURIComponent(previewImage)}` : ""}`
                );
              }}
              style={[
                styles.actionBtn,
                {
                  borderColor: pieceCount > 0 ? "#3B82F6" : colors.border,
                  backgroundColor: pieceCount > 0 ? "#EFF6FF" : "transparent",
                },
              ]}
            >
              <Feather name="calendar" size={14} color={pieceCount > 0 ? "#3B82F6" : colors.mutedForeground} />
              <Text style={[styles.actionBtnText, { color: pieceCount > 0 ? "#3B82F6" : colors.mutedForeground }]}>
                {t("ob_log")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                if (pieceCount === 0) return;
                setShowSaveModal(true);
              }}
              style={[
                styles.actionBtn,
                {
                  borderColor: pieceCount > 0 ? colors.accent : colors.border,
                  backgroundColor: pieceCount > 0 ? colors.secondary : "transparent",
                },
              ]}
            >
              <Feather name="bookmark" size={14} color={pieceCount > 0 ? colors.accent : colors.mutedForeground} />
              <Text style={[styles.actionBtnText, { color: pieceCount > 0 ? colors.accent : colors.mutedForeground }]}>
                {t("ob_save")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handlePost}
              style={[
                styles.actionBtn,
                {
                  borderColor: pieceCount > 0 ? colors.primary : colors.border,
                  backgroundColor: pieceCount > 0 ? colors.primary : "transparent",
                  flex: 1.2,
                },
              ]}
            >
              <Feather name="camera" size={14} color={pieceCount > 0 ? colors.primaryForeground : colors.mutedForeground} />
              <Text style={[styles.actionBtnText, { color: pieceCount > 0 ? colors.primaryForeground : colors.mutedForeground }]}>
                {t("ob_post_look")}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        <View
          style={[
            styles.divider,
            isWideScreen && styles.dividerWide,
            { backgroundColor: colors.border },
          ]}
        />

        <View style={[styles.pickerSection, isWideScreen && styles.pickerSectionWide]}>
          <Text style={[styles.pickerTitle, { color: colors.foreground }]}>{t("ob_your_wardrobe")}</Text>
          {filterCat === "accessories" ? (
            <Text style={[styles.multiSelectHint, { color: colors.mutedForeground }]}>
              {t("ob_accessories_multi_select")}
            </Text>
          ) : null}
          {isWardrobeLoading ? (
            <View style={[styles.emptyWardrobe, { backgroundColor: colors.secondary }]}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>{t("loading_wardrobe")}</Text>
            </View>
          ) : items.length === 0 ? (
            <View style={[styles.emptyWardrobe, { backgroundColor: colors.secondary }]}>
              <Feather name="layers" size={28} color={colors.border} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{t("ob_no_items")}</Text>
              <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
                {t("ob_add_clothes_first")}
              </Text>
              <TouchableOpacity
                onPress={() => router.push("/add-item")}
                style={[styles.addBtn, { backgroundColor: colors.primary }]}
              >
                <Text style={[styles.addBtnText, { color: colors.primaryForeground }]}>
                  {t("ob_add_items")}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {filteredItems.length === 0 ? (
                <Text style={[styles.noItems, { color: colors.mutedForeground }]}>
                  {t("ob_no_items_cat")}
                </Text>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.itemCarousel}
                >
                  {filteredItems.map((item) => (
                    <DraggableItem
                      key={item.id}
                      item={item}
                      isAssigned={assignedIds.has(item.id)}
                      onTap={() => assignItem(item)}
                    />
                  ))}
                </ScrollView>
              )}
            </>
          )}
        </View>
      </ScrollView>

      <Modal visible={showPreview} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.previewModal, { backgroundColor: colors.background }]}>
          <View
            style={[
              styles.previewModalHeader,
              {
                borderBottomColor: colors.border,
                paddingTop: Platform.OS === "web" ? 24 : 20,
              },
            ]}
          >
            <TouchableOpacity onPress={() => setShowPreview(false)}>
              <Feather name="x" size={22} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={[styles.previewModalTitle, { color: colors.foreground }]}>
              {t("ob_look_preview_title")}
            </Text>
            <View style={styles.previewHeaderActions}>
              <TouchableOpacity
                onPress={() => handleGeneratePreview(true)}
                disabled={isGenerating}
                style={[styles.regenBtn, { backgroundColor: colors.secondary }]}
              >
                <Feather name="refresh-cw" size={13} color={colors.mutedForeground} />
                <Text style={[styles.regenBtnText, { color: colors.mutedForeground }]}>{t("ob_regenerate")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setShowPreview(false);
                  if (pieceCount > 0) setShowSaveModal(true);
                }}
                style={[styles.saveFromPreviewBtn, { backgroundColor: colors.secondary }]}
              >
                <Feather name="bookmark" size={14} color={colors.accent} />
                <Text style={[styles.saveFromPreviewText, { color: colors.accent }]}>{t("ob_save")}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView contentContainerStyle={styles.previewModalContent}>
            {isGenerating ? (
              <View style={[styles.generatingContainer, { backgroundColor: colors.secondary }]}>
                <ActivityIndicator size="large" color={colors.accent} />
                <Text style={[styles.generatingText, { color: colors.foreground }]}>
                  {t("ob_generating_your_look")}
                </Text>
                <Text style={[styles.generatingSubText, { color: colors.mutedForeground }]}>
                  {t((["ob_preview_stage_prepare", "ob_preview_stage_generate", "ob_preview_stage_finish"] as const)[previewProgressStage] ?? "ob_preview_stage_finish")}
                </Text>
              </View>
            ) : previewImage ? (
              <>
                <View style={styles.previewImage}>
                  {isSvgPreview(previewImage) ? (
                    <SvgXml xml={decodeSvgPreview(previewImage)} width="100%" height="100%" />
                  ) : (
                    <Image source={{ uri: previewSource(previewImage) }} style={styles.previewRaster} contentFit="cover" />
                  )}
                </View>
                <View style={styles.previewPieces}>
                  <Text style={[styles.previewPiecesLabel, { color: colors.mutedForeground }]}>
                    {t("ob_outfit_pieces")}
                  </Text>
                  {Object.entries(assigned).map(([key, item]) => {
                    if (!item) return null;
                    return (
                      <View
                        key={key}
                        style={[styles.previewPieceRow, { borderColor: colors.border }]}
                      >
                        <View
                          style={[styles.previewPieceColor, { backgroundColor: item.colorHex }]}
                        />
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[styles.previewPieceName, { color: colors.foreground }]}
                          >
                            {item.name}
                          </Text>
                          <Text
                            style={[styles.previewPieceCat, { color: colors.mutedForeground }]}
                          >
                            {item.color} · {item.category}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </>
            ) : null}
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={showSaveModal}
        animationType="slide"
        presentationStyle="pageSheet"
        transparent
      >
        <View style={styles.saveModalOverlay}>
          <View
            style={[
              styles.saveModalCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.saveModalTitle, { color: colors.foreground }]}>
              {t("ob_save_template")}
            </Text>
            <Text style={[styles.saveModalSubtitle, { color: colors.mutedForeground }]}>
              {t("ob_give_name")}
            </Text>
            <TextInput
              value={outfitName}
              onChangeText={setOutfitName}
              placeholder={t("ob_outfit_name_ph")}
              placeholderTextColor={colors.mutedForeground}
              autoFocus
              style={[
                styles.saveModalInput,
                { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background },
              ]}
            />
            <View style={styles.saveModalActions}>
              <TouchableOpacity
                onPress={() => setShowSaveModal(false)}
                style={[styles.saveModalCancel, { borderColor: colors.border }]}
              >
                <Text style={[styles.saveModalCancelText, { color: colors.mutedForeground }]}>
                  {t("cancel")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveOutfit}
                disabled={!outfitName.trim()}
                style={[
                  styles.saveModalConfirm,
                  {
                    backgroundColor: outfitName.trim() ? colors.primary : colors.secondary,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.saveModalConfirmText,
                    {
                      color: outfitName.trim()
                        ? colors.primaryForeground
                        : colors.mutedForeground,
                    },
                  ]}
                >
                  {t("ob_save")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showSavedOutfits}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={[styles.savedOutfitsModal, { backgroundColor: colors.background }]}>
          <View
            style={[
              styles.savedOutfitsHeader,
              {
                borderBottomColor: colors.border,
                paddingTop: Platform.OS === "web" ? 24 : 20,
              },
            ]}
          >
            <TouchableOpacity onPress={() => setShowSavedOutfits(false)}>
              <Feather name="x" size={22} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={[styles.savedOutfitsTitle, { color: colors.foreground }]}>
              {t("ob_saved_outfits")}
            </Text>
            <View style={{ width: 22 }} />
          </View>
          <ScrollView contentContainerStyle={styles.savedOutfitsList}>
            {savedOutfits.length === 0 ? (
              <View style={styles.savedOutfitsEmpty}>
                <Feather name="bookmark" size={36} color={colors.border} />
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                  {t("ob_no_saved")}
                </Text>
                <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
                  {t("ob_save_hint")}
                </Text>
              </View>
            ) : (
              savedOutfits.map((outfit) => {
                const pieces = Object.values(outfit.items).filter(Boolean) as ClothingItem[];
                return (
                  <TouchableOpacity
                    key={outfit.id}
                    onPress={() => handleLoadSavedOutfit(outfit)}
                    style={[
                      styles.savedOutfitCard,
                      { backgroundColor: colors.card, borderColor: colors.border },
                    ]}
                  >
                    {outfit.previewImage ? (
                      <View style={styles.savedOutfitThumb}>
                        {isSvgPreview(outfit.previewImage) ? (
                          <SvgXml xml={decodeSvgPreview(outfit.previewImage)} width="100%" height="100%" />
                        ) : (
                          <Image source={{ uri: previewSource(outfit.previewImage) }} style={styles.previewRaster} contentFit="cover" />
                        )}
                      </View>
                    ) : (
                      <View
                        style={[styles.savedOutfitThumb, { backgroundColor: colors.secondary }]}
                      >
                        <View style={styles.colorSwatches}>
                          {pieces.slice(0, 4).map((p, i) => (
                            <View
                              key={i}
                              style={[
                                styles.miniSwatch,
                                { backgroundColor: p.colorHex, marginLeft: i > 0 ? -4 : 0 },
                              ]}
                            />
                          ))}
                        </View>
                      </View>
                    )}
                    <View style={styles.savedOutfitInfo}>
                      <Text style={[styles.savedOutfitName, { color: colors.foreground }]}>
                        {outfit.name}
                      </Text>
                      <Text style={[styles.savedOutfitMeta, { color: colors.mutedForeground }]}>
                        {pieces.length} {t(pieces.length === 1 ? "ob_piece" : "ob_pieces")} · {new Date(outfit.createdAt).toLocaleDateString()}
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  headerSub: { fontSize: 12, fontWeight: "400", marginTop: 1 },
  savedBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 100,
  },
  savedBadge: { fontSize: 12, fontWeight: "700" },
  scrollContent: { paddingTop: 16, gap: 0 },
  canvas: { width: "100%", maxWidth: 560, alignSelf: "center", paddingHorizontal: 18, gap: 10 },
  canvasWide: { maxWidth: 1120, paddingHorizontal: 28 },
  canvasLabelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  canvasLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 1.2 },
  weatherChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  weatherChipText: { fontSize: 11, fontWeight: "500" },
  weatherNoteRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, padding: 10, borderRadius: 10, borderWidth: 1, marginBottom: 12 },
  weatherNoteText: { fontSize: 12, fontWeight: "500", flex: 1, lineHeight: 17 },
  lookCard: {
    borderRadius: 24,
    paddingTop: 16,
    paddingBottom: 14,
    overflow: "hidden",
  },
  lookCardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: 18,
  },
  reshuffleBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 8, paddingLeft: 12 },
  reshuffleText: { fontSize: 13, fontWeight: "600" },
  lookStage: { height: 384, position: "relative", marginHorizontal: 12, marginTop: 2, borderRadius: 22, overflow: "hidden" },
  lookStageWide: { height: 430, marginHorizontal: 24 },
  lookStageEmpty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  lookStageEmptyIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  lookPiece: { position: "absolute", overflow: "visible" },
  lookPieceImage: { width: "100%", height: "100%" },
  lookPieceFallback: { flex: 1, borderWidth: 1, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  lookPieceControl: {
    position: "absolute",
    top: 3,
    right: 3,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#1C1512",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  categorySwatches: { gap: 8, paddingHorizontal: 10, paddingTop: 5, paddingBottom: 2 },
  categorySwatchesWide: { flexGrow: 1, justifyContent: "center", gap: 14, paddingHorizontal: 22 },
  categorySwatch: { width: 94, height: 108, borderRadius: 15, borderWidth: 1, paddingHorizontal: 8, paddingTop: 7, paddingBottom: 9, alignItems: "center", position: "relative" },
  categorySwatchWide: { width: 120, height: 118 },
  categorySwatchActive: { transform: [{ translateY: -2 }] },
  categorySwatchActiveBadge: { position: "absolute", top: 6, right: 6, width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  categorySwatchVisual: { width: 72, height: 72, alignItems: "center", justifyContent: "center" },
  categorySwatchImage: { width: "100%", height: "100%" },
  categorySwatchLabel: { fontSize: 12, fontWeight: "600", textAlign: "center", width: "100%", marginTop: 3 },
  previewReferenceOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  previewReferenceTitle: { fontSize: 13, fontWeight: "700" },
  previewReferenceHint: { fontSize: 11, lineHeight: 16, marginTop: 2 },
  previewBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 4,
  },
  previewBtnText: { fontSize: 15, fontWeight: "700" },
  previewError: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 10,
    gap: 2,
  },
  previewErrorTitle: { color: "#991B1B", fontSize: 12, fontWeight: "700" },
  previewErrorText: { color: "#B91C1C", fontSize: 12, lineHeight: 17 },
  canvasActions: { flexDirection: "row", gap: 8, marginTop: 4 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
  },
  actionBtnText: { fontSize: 13, fontWeight: "600" },
  divider: { height: 1, width: "100%", maxWidth: 524, alignSelf: "center", marginVertical: 20 },
  dividerWide: { maxWidth: 1064 },
  pickerSection: { width: "100%", maxWidth: 560, alignSelf: "center", paddingHorizontal: 18, gap: 14 },
  pickerSectionWide: { maxWidth: 1120, paddingHorizontal: 28 },
  pickerTitle: { fontSize: 18, fontWeight: "700" },
  multiSelectHint: { fontSize: 12, lineHeight: 17, marginTop: -8 },
  emptyWardrobe: {
    borderRadius: 16,
    padding: 28,
    alignItems: "center",
    gap: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: "600", marginTop: 4 },
  emptySubtitle: { fontSize: 13, textAlign: "center" },
  addBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 100,
    marginTop: 6,
  },
  addBtnText: { fontSize: 14, fontWeight: "600" },
  noItems: { fontSize: 14, textAlign: "center", paddingVertical: 24 },
  itemCarousel: { gap: 10, paddingRight: 18, paddingBottom: 4 },
  draggableWrap: { width: 82, alignItems: "center", gap: 6 },
  itemCard: {
    width: 72,
    height: 72,
    borderRadius: 16,
    overflow: "hidden",
    position: "relative",
  },
  itemCardNoImage: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  assignedOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  itemCardName: { fontSize: 11, fontWeight: "500", textAlign: "center", maxWidth: 80 },
  previewModal: { flex: 1 },
  previewModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  previewModalTitle: { fontSize: 17, fontWeight: "700" },
  previewHeaderActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  regenBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 100,
  },
  regenBtnText: { fontSize: 12, fontWeight: "600" },
  saveFromPreviewBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 100,
  },
  saveFromPreviewText: { fontSize: 13, fontWeight: "600" },
  previewModalContent: { padding: 18, gap: 16 },
  generatingContainer: {
    borderRadius: 20,
    padding: 48,
    alignItems: "center",
    gap: 12,
    minHeight: 300,
    justifyContent: "center",
  },
  generatingText: { fontSize: 17, fontWeight: "600", marginTop: 8 },
  generatingSubText: { fontSize: 13, textAlign: "center" },
  previewImage: {
    width: "100%",
    aspectRatio: 2 / 3,
    borderRadius: 20,
    overflow: "hidden",
  },
  previewRaster: { width: "100%", height: "100%" },
  previewPieces: { gap: 8 },
  previewPiecesLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  previewPieceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  previewPieceColor: { width: 36, height: 36, borderRadius: 8, flexShrink: 0 },
  previewPieceName: { fontSize: 14, fontWeight: "600" },
  previewPieceCat: { fontSize: 12, fontWeight: "400", marginTop: 1 },
  saveModalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  saveModalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    padding: 24,
    gap: 14,
  },
  saveModalTitle: { fontSize: 18, fontWeight: "700" },
  saveModalSubtitle: { fontSize: 14, lineHeight: 20 },
  saveModalInput: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
  },
  saveModalActions: { flexDirection: "row", gap: 10 },
  saveModalCancel: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  saveModalCancelText: { fontSize: 15, fontWeight: "600" },
  saveModalConfirm: {
    flex: 1.5,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
  },
  saveModalConfirmText: { fontSize: 15, fontWeight: "600" },
  savedOutfitsModal: { flex: 1 },
  savedOutfitsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  savedOutfitsTitle: { fontSize: 18, fontWeight: "700" },
  savedOutfitsList: { padding: 18, gap: 12 },
  savedOutfitsEmpty: {
    alignItems: "center",
    paddingVertical: 60,
    gap: 10,
  },
  savedOutfitCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  savedOutfitThumb: {
    width: 72,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  colorSwatches: { flexDirection: "row" },
  miniSwatch: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#F9F8F6",
  },
  savedOutfitInfo: { flex: 1, paddingVertical: 14 },
  savedOutfitName: { fontSize: 15, fontWeight: "600" },
  savedOutfitMeta: { fontSize: 12, marginTop: 2 },
});
