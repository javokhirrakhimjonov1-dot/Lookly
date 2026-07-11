import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
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
import { useColors } from "@/hooks/useColors";
import {
  type ClothingCategory,
  type ClothingItem,
  type Season,
  useWardrobe,
} from "@/contexts/WardrobeContext";
import { useSocial } from "@/contexts/SocialContext";
import { useWeather } from "@/contexts/WeatherContext";
import { useUserProfile } from "@/contexts/UserProfileContext";
import { useLanguage } from "@/contexts/LanguageContext";

type OutfitSlotKey = "outerwear" | "tops" | "bottoms" | "dresses" | "shoes" | "accessories";

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

function categoryToSlotKey(cat: ClothingCategory): OutfitSlotKey {
  return cat as OutfitSlotKey;
}

const API_BASE = getApiBase();

// ─── Combo fingerprint ───────────────────────────────────────────────────────
function makeComboKey(assigned: Partial<Record<OutfitSlotKey, ClothingItem>>): string {
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
      if (isHot && i.fabricWeight === "heavy") return false;
      if (isCold && i.fabricWeight === "light") return false;
      // Pre-filter: remove sandals/open-toe shoes when temperature is below threshold
      if (cat === "shoes" && isCool && isSummerOnlyShoe(i)) return false;
      return true;
    });
    // Fallback: relax fabric constraint but keep sandal ban if cool
    if (pool.length === 0) {
      pool = allItems.filter(
        (i) =>
          i.category === cat &&
          !(cat === "shoes" && isCool && isSummerOnlyShoe(i))
      );
    }
    // Last resort: full category pool
    if (pool.length === 0) pool = allItems.filter((i) => i.category === cat);

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

    lastAttempt = next;

    // ── Climate coherence audit ──────────────────────────────────────────
    if (!isClimateCompatible(next, temperature)) continue; // bad combo — retry

    // Track the best climate-valid result so far for the fallback
    if (!lastClimateValid) lastClimateValid = next;

    // Deduplicate: only return if this combo hasn't been shown in this session
    if (!sessionCombos.has(makeComboKey(next))) return next;
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
  userAge?: number | null
): Promise<string> {
  const body = {
    items: items.map((i) => ({
      name: i.name,
      color: i.color,
      colorHex: i.colorHex,
      category: i.category,
    })),
    weather,
    temperature,
    userBodyPhotoBase64: userBodyPhotoBase64 ?? undefined,
    userBodyPhotoMime: userBodyPhotoBase64 ? (userBodyPhotoMime ?? "image/jpeg") : undefined,
    userGender: userGender ?? undefined,
    userAge: userAge ?? undefined,
  };

  const res = await fetch(`${API_BASE}/outfit-preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let errMsg = `Preview unavailable (${res.status})`;
    try {
      const errBody = await res.json() as { error?: string };
      if (errBody.error) errMsg = errBody.error;
    } catch {}
    throw new Error(errMsg);
  }
  const data = await res.json() as { image: string };
  return data.image;
}

interface SlotCardProps {
  slotKey: OutfitSlotKey;
  label: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  assignedItem: ClothingItem | null;
  onClear: () => void;
  flex?: number;
  isLocked?: boolean;
}

function SlotCard({ slotKey: _slotKey, label, icon, assignedItem, onClear, flex = 1, isLocked }: SlotCardProps) {
  const colors = useColors();
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  React.useEffect(() => {
    if (assignedItem) {
      scale.value = withSpring(1.05, { damping: 10 }, () => {
        scale.value = withSpring(1);
      });
    }
  }, [assignedItem?.id]);

  return (
    <Animated.View
      style={[
        styles.slot,
        animStyle,
        {
          flex,
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderStyle: assignedItem ? "solid" : "dashed",
        },
      ]}
    >
      {assignedItem ? (
        <>
          {assignedItem.imageUri ? (
            <Image
              source={{ uri: assignedItem.imageUri }}
              style={StyleSheet.absoluteFillObject}
              contentFit="contain"
            />
          ) : (
            <View style={styles.slotNoImage}>
              <Feather name={icon} size={22} color="#C8B9AE" />
            </View>
          )}
          {isLocked && (
            <View style={[styles.lockBadge, { backgroundColor: "rgba(28,21,18,0.12)" }]}>
              <Feather name="lock" size={9} color={colors.foreground} />
            </View>
          )}
          <TouchableOpacity
            onPress={onClear}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={[styles.clearBtn, { backgroundColor: "rgba(28,21,18,0.10)" }]}
          >
            <Feather name="x" size={12} color={colors.foreground} />
          </TouchableOpacity>
        </>
      ) : (
        <View style={styles.slotEmpty}>
          <Feather name={icon} size={18} color={colors.border} />
          <Text style={[styles.slotLabel, { color: colors.mutedForeground }]}>{label}</Text>
        </View>
      )}
    </Animated.View>
  );
}

interface DraggableItemProps {
  item: ClothingItem;
  isAssigned: boolean;
  onTap: () => void;
}

function DraggableItem({ item, isAssigned, onTap }: DraggableItemProps) {
  const colors = useColors();
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
        <View style={[styles.itemCard, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}>
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

export default function OutfitBuilderScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { items, saveOutfit, savedOutfits } = useWardrobe();
  const { addLook } = useSocial();
  const { condition, temperature, weatherCode } = useWeather();
  const { bodyPhotoBase64, bodyPhotoMime, gender, age } = useUserProfile();
  const { t } = useLanguage();

  const FILTER_CATEGORIES: { key: "all" | ClothingCategory; label: string }[] = [
    { key: "all", label: t("cat_all") },
    { key: "tops", label: t("cat_tops") },
    { key: "bottoms", label: t("cat_bottoms") },
    { key: "dresses", label: t("cat_dresses") },
    { key: "outerwear", label: t("cat_outerwear") },
    { key: "shoes", label: t("cat_shoes") },
    { key: "accessories", label: t("cat_accessories") },
  ];

  const topPad = getTopPadding(insets.top);

  const [assigned, setAssigned] = useState<Partial<Record<OutfitSlotKey, ClothingItem>>>({});
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

  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const [showSaveModal, setShowSaveModal] = useState(false);
  const [outfitName, setOutfitName] = useState("");

  const [showSavedOutfits, setShowSavedOutfits] = useState(false);
  const [isAutoLoading, setIsAutoLoading] = useState(false);
  const [autoWeatherNote, setAutoWeatherNote] = useState<string | null>(null);

  const { autoStart, anchorItemId } = useLocalSearchParams<{ autoStart?: string; anchorItemId?: string }>();
  const autoStartFired = useRef(false);
  const anchorFired = useRef(false);

  useEffect(() => {
    if (autoStart === "true" && !autoStartFired.current && items.length > 0) {
      autoStartFired.current = true;
      void handleAutoSuggest();
    }
  });

  useEffect(() => {
    if (anchorItemId && !anchorFired.current && items.length > 0) {
      anchorFired.current = true;
      const anchor = items.find((i) => i.id === anchorItemId);
      if (anchor) {
        const slotKey = categoryToSlotKey(anchor.category);
        setAssigned({ [slotKey]: anchor });
        setLockedSlots(new Set([slotKey]));
        setTimeout(() => void handleAutoSuggest(), 100);
      }
    }
  });

  const assignItem = useCallback((item: ClothingItem) => {
    const slotKey = categoryToSlotKey(item.category);
    setPreviewImage(null);
    setAssigned((prev) => {
      // Toggle off: same item tapped again
      if (prev[slotKey]?.id === item.id) {
        const next = { ...prev };
        delete next[slotKey];
        setLockedSlots((ls) => { const n = new Set(ls); n.delete(slotKey); return n; });
        return next;
      }
      // Lock the new slot
      const newLocked = new Set([...lockedSlots, slotKey]);
      setLockedSlots(newLocked);
      // Place item, then immediately auto-fill remaining EMPTY unlocked slots
      const withItem = { ...prev, [slotKey]: item };
      const filled = localSmartFill(
        withItem, items, newLocked, temperature, sessionCombos.current, "fill-empty"
      );
      sessionCombos.current.add(makeComboKey(filled));
      return filled;
    });
  }, [items, lockedSlots, temperature]);

  const clearSlot = useCallback((slotKey: OutfitSlotKey) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPreviewImage(null);
    setAssigned((prev) => {
      const next = { ...prev };
      delete next[slotKey];
      return next;
    });
    setLockedSlots((ls) => { const n = new Set(ls); n.delete(slotKey); return n; });
  }, []);

  const handleAutoSuggest = async () => {
    if (isAutoLoading) return;
    setIsAutoLoading(true);
    setAutoWeatherNote(null);

    // ── RESHUFFLE PATH: local-only, instant, never repeats ─────────────────
    if (hasDoneAuto) {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const next = localSmartFill(
          assigned, items, lockedSlots, temperature,
          sessionCombos.current, "reshuffle"
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
        headers: { "Content-Type": "application/json" },
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
          })),
          weather: condition,
          weatherCode,
          temperature,
          lockedIds: [...lockedSlots]
            .map((k) => assigned[k]?.id)
            .filter((id): id is string => !!id),
        }),
      });

      const data = await res.json() as {
        outfits: { name: string; mood: string; weatherNote?: string | null; items: { itemId: string; role: string }[] }[]
      };
      const outfitList = (data.outfits ?? []).filter((o) => o.items.length > 0);
      if (outfitList.length === 0) throw new Error("no outfits");

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
      const next = localSmartFill(
        assigned, items, lockedSlots, temperature,
        sessionCombos.current, "reshuffle"
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
    const pieces = Object.values(assigned).filter(Boolean) as ClothingItem[];
    if (pieces.length === 0) {
      Alert.alert("No items selected", "Add at least one item to preview the look.");
      return;
    }
    if (previewImage && !forceRegenerate) {
      setShowPreview(true);
      return;
    }
    setIsGenerating(true);
    setShowPreview(true);
    try {
      const img = await generateOutfitPreview(pieces, condition, temperature, bodyPhotoBase64, bodyPhotoMime, gender, age);
      setPreviewImage(img);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not generate the look preview. Please try again.";
      Alert.alert("Preview failed", msg);
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
    router.back();
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
  const hasDress = !!assigned["dresses"];

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
        <TouchableOpacity onPress={() => router.back()}>
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
        <TouchableOpacity
          onPress={handleAutoSuggest}
          disabled={isAutoLoading}
          style={[styles.autoBtn, { backgroundColor: colors.secondary, marginLeft: 8, opacity: isAutoLoading ? 0.6 : 1 }]}
        >
          {isAutoLoading ? (
            <ActivityIndicator size="small" color={colors.accent} style={{ width: 14, height: 14 }} />
          ) : (
            <Feather name={hasDoneAuto ? "refresh-cw" : "zap"} size={14} color={colors.accent} />
          )}
          <Text style={[styles.autoBtnText, { color: colors.accent }]}>
            {isAutoLoading ? t("ob_styling") : hasDoneAuto ? t("ob_reshuffle") : t("ob_auto")}
          </Text>
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
        <Animated.View style={[styles.canvas, canvasAnimStyle]}>
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

          <View style={styles.canvasRow}>
            <SlotCard
              slotKey="outerwear"
              label={t("cat_outerwear")}
              icon="layers"
              assignedItem={assigned["outerwear"] ?? null}
              onClear={() => clearSlot("outerwear")}
              isLocked={lockedSlots.has("outerwear")}
            />
            <SlotCard
              slotKey="tops"
              label={t("ob_slot_top")}
              icon="wind"
              assignedItem={hasDress ? null : (assigned["tops"] ?? null)}
              onClear={() => clearSlot("tops")}
              isLocked={lockedSlots.has("tops")}
            />
          </View>

          {hasDress ? (
            <View style={styles.canvasRow}>
              <SlotCard
                slotKey="dresses"
                label={t("ob_slot_dress")}
                icon="star"
                assignedItem={assigned["dresses"] ?? null}
                onClear={() => clearSlot("dresses")}
                isLocked={lockedSlots.has("dresses")}
              />
            </View>
          ) : (
            <View style={styles.canvasRow}>
              <SlotCard
                slotKey="bottoms"
                label={t("ob_slot_bottom")}
                icon="minus"
                assignedItem={assigned["bottoms"] ?? null}
                onClear={() => clearSlot("bottoms")}
                isLocked={lockedSlots.has("bottoms")}
              />
            </View>
          )}

          <View style={styles.canvasRow}>
            <SlotCard
              slotKey="shoes"
              label={t("cat_shoes")}
              icon="chevrons-up"
              assignedItem={assigned["shoes"] ?? null}
              onClear={() => clearSlot("shoes")}
              isLocked={lockedSlots.has("shoes")}
            />
            <SlotCard
              slotKey="accessories"
              label={t("ob_slot_accessory")}
              icon="circle"
              assignedItem={assigned["accessories"] ?? null}
              onClear={() => clearSlot("accessories")}
              isLocked={lockedSlots.has("accessories")}
            />
          </View>

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

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <View style={styles.pickerSection}>
          <Text style={[styles.pickerTitle, { color: colors.foreground }]}>{t("ob_your_wardrobe")}</Text>
          {items.length === 0 ? (
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
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterPills}
              >
                {FILTER_CATEGORIES.map((c) => {
                  const count =
                    c.key === "all"
                      ? items.length
                      : items.filter((i) => i.category === c.key).length;
                  if (c.key !== "all" && count === 0) return null;
                  return (
                    <Pressable
                      key={c.key}
                      onPress={() => setFilterCat(c.key)}
                      style={[
                        styles.filterPill,
                        {
                          backgroundColor:
                            filterCat === c.key ? colors.primary : colors.secondary,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.filterPillText,
                          {
                            color:
                              filterCat === c.key
                                ? colors.primaryForeground
                                : colors.mutedForeground,
                          },
                        ]}
                      >
                        {c.label} {count}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {filteredItems.length === 0 ? (
                <Text style={[styles.noItems, { color: colors.mutedForeground }]}>
                  {t("ob_no_items_cat")}
                </Text>
              ) : (
                <View style={styles.itemGrid}>
                  {filteredItems.map((item) => (
                    <DraggableItem
                      key={item.id}
                      item={item}
                      isAssigned={assignedIds.has(item.id)}
                      onTap={() => assignItem(item)}
                    />
                  ))}
                </View>
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
                  {t("ob_ai_styling")}
                </Text>
              </View>
            ) : previewImage ? (
              <>
                <Image
                  source={{ uri: `data:image/png;base64,${previewImage}` }}
                  style={styles.previewImage}
                  contentFit="cover"
                />
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
                      <Image
                        source={{ uri: `data:image/png;base64,${outfit.previewImage}` }}
                        style={styles.savedOutfitThumb}
                        contentFit="cover"
                      />
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

const SLOT_HEIGHT = 90;

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
  autoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 100,
  },
  autoBtnText: { fontSize: 13, fontWeight: "600" },
  scrollContent: { paddingTop: 18, gap: 0 },
  canvas: { paddingHorizontal: 18, gap: 10 },
  canvasLabelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  canvasLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 1.2 },
  weatherChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  weatherChipText: { fontSize: 11, fontWeight: "500" },
  weatherNoteRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, padding: 10, borderRadius: 10, borderWidth: 1, marginBottom: 12 },
  weatherNoteText: { fontSize: 12, fontWeight: "500", flex: 1, lineHeight: 17 },
  canvasRow: { flexDirection: "row", gap: 10, minHeight: SLOT_HEIGHT },
  slot: {
    borderRadius: 16,
    borderWidth: 1.5,
    minHeight: SLOT_HEIGHT,
    overflow: "hidden",
    position: "relative",
  },
  slotEmpty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 12,
  },
  slotNoImage: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  slotLabel: { fontSize: 11, fontWeight: "600", textAlign: "center" },
  slotFilledContent: { flex: 1, padding: 10, justifyContent: "flex-end" },
  slotFilledOverlay: { backgroundColor: "transparent" },
  slotFilledName: { fontSize: 13, fontWeight: "700", lineHeight: 16 },
  slotFilledSub: { fontSize: 10, fontWeight: "500", marginTop: 2 },
  lockBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  clearBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
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
  divider: { height: 1, marginHorizontal: 18, marginVertical: 20 },
  pickerSection: { paddingHorizontal: 18, gap: 14 },
  pickerTitle: { fontSize: 18, fontWeight: "700" },
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
  filterPills: { gap: 8, paddingRight: 18 },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 100,
  },
  filterPillText: { fontSize: 13, fontWeight: "600" },
  noItems: { fontSize: 14, textAlign: "center", paddingVertical: 24 },
  itemGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  draggableWrap: { width: "30%", alignItems: "center", gap: 6 },
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
  },
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
