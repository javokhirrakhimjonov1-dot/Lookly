import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  type ClothingCategory,
  type ClothingItem,
  type FabricWeight,
  type Season,
  useWardrobe,
} from "@/contexts/WardrobeContext";
import { useWeather } from "@/contexts/WeatherContext";

// ─── Slot definitions ─────────────────────────────────────────────────────────

const SHUFFLE_SLOTS: {
  key: ClothingCategory;
  label: string;
  icon: React.ComponentProps<typeof Feather>["name"];
}[] = [
  { key: "outerwear", label: "Outerwear", icon: "layers" },
  { key: "tops", label: "Top", icon: "wind" },
  { key: "bottoms", label: "Bottom", icon: "minus" },
  { key: "shoes", label: "Shoes", icon: "chevrons-up" },
  { key: "accessories", label: "Accessory", icon: "circle" },
];

const DISLIKED_KEY = "@lookly_disliked_outfits";

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function hashOutfit(slots: Partial<Record<ClothingCategory, ClothingItem | null>>): string {
  return Object.values(slots)
    .filter(Boolean)
    .map((i) => i!.id)
    .sort()
    .join("|");
}

function getCurrentSeason(): Season {
  const m = new Date().getMonth();
  if (m >= 2 && m <= 4) return "spring";
  if (m >= 5 && m <= 7) return "summer";
  if (m >= 8 && m <= 10) return "fall";
  return "winter";
}

function getFabricWeightForTemp(temp: number): FabricWeight[] {
  if (temp >= 28) return ["light"];
  if (temp >= 18) return ["light", "medium"];
  if (temp >= 8) return ["medium", "heavy"];
  return ["heavy"];
}

// ─── Discovery engine utilities ───────────────────────────────────────────────

/**
 * True if a hex color is low-saturation (white, black, grey, beige, taupe, etc.)
 * Used to identify "neutral base" items vs "accent / pop of colour" items.
 */
function isNeutralColor(hex: string): boolean {
  const clean = hex.startsWith("#") ? hex : "#" + hex;
  const r = parseInt(clean.slice(1, 3), 16);
  const g = parseInt(clean.slice(3, 5), 16);
  const b = parseInt(clean.slice(5, 7), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return true;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? true : (max - min) / max < 0.22;
}

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

/** Temperature threshold below which open-toe shoes are banned. */
const SANDAL_TEMP_MIN = 22;

// ─── Edgy style taglines ──────────────────────────────────────────────────────

const TAGLINES: Record<string, string[]> = {
  en: [
    "READY TO BREAK THE MAINSTREAM",
    "GOING AGAINST THE FLOW",
    "BOLD EXPERIMENTATION",
    "DEFYING THE STYLE RULES",
  ],
  ru: [
    "ГОТОВ СЛОМАТЬ СТЕРЕОТИПЫ",
    "ПРОТИВ ТЕЧЕНИЯ",
    "СМЕЛЫЙ ЭКСПЕРИМЕНТ",
    "ВНЕ ПРАВИЛ СТИЛЯ",
  ],
  uz: [
    "MODA QOIDALARINI BUZISHGA TAYYOR",
    "OQIMGA QARSHI",
    "JASUR TAJRIBA",
    "USLUB QOIDALARIDAN TASHQARI",
  ],
};

function pickTagline(lang: string): string {
  const pool = TAGLINES[lang] ?? TAGLINES.en!;
  return pool[Math.floor(Math.random() * pool.length)]!;
}

/**
 * Discovery pick: heavily biases toward unworn / rarely-worn items.
 * This is the "forgotten clothes" engine — timesWorn=0 gets 6× weight,
 * timesWorn≤2 gets 3×, everything else gets 1× (still eligible).
 */
function pickDiscovery(pool: ClothingItem[]): ClothingItem | null {
  if (pool.length === 0) return null;
  const weighted: ClothingItem[] = [];
  for (const item of pool) {
    const worn = item.timesWorn ?? 0;
    const w = worn === 0 ? 6 : worn <= 2 ? 3 : 1;
    for (let i = 0; i < w; i++) weighted.push(item);
  }
  return weighted[Math.floor(Math.random() * weighted.length)] ?? null;
}

/**
 * Accent pick for accessories / outerwear.
 * When the base outfit (tops + bottoms) is neutral/earthy, it pushes a
 * non-neutral "pop of colour" piece to create complementary contrast.
 * Still uses the discovery bias so forgotten items surface first.
 */
function pickAccent(pool: ClothingItem[], preferNonNeutral: boolean): ClothingItem | null {
  if (pool.length === 0) return null;
  const nonNeutral = pool.filter((i) => !isNeutralColor(i.colorHex));
  const candidates = preferNonNeutral && nonNeutral.length > 0 ? nonNeutral : pool;
  return pickDiscovery(candidates);
}

/**
 * Returns true if the base outfit pieces (tops / bottoms / dresses currently
 * in slots) are all low-saturation neutrals — signals that an accent piece
 * should add a colour pop.
 */
function slotBaseIsNeutral(
  slots: Partial<Record<ClothingCategory, ClothingItem | null>>
): boolean {
  const baseCats: ClothingCategory[] = ["tops", "bottoms", "dresses"];
  const baseItems = baseCats.map((c) => slots[c]).filter(Boolean) as ClothingItem[];
  if (baseItems.length === 0) return false;
  return baseItems.every((i) => isNeutralColor(i.colorHex));
}

/** Climate safety check for the shuffle screen's SlotMap. */
function shuffleClimateOk(
  slots: Partial<Record<ClothingCategory, ClothingItem | null>>,
  temp: number
): boolean {
  const shoes = slots["shoes"];
  if (shoes && isSummerOnlyShoe(shoes) && temp < SANDAL_TEMP_MIN) return false;
  return true;
}

// ─── Component ───────────────────────────────────────────────────────────────

type SlotMap = Partial<Record<ClothingCategory, ClothingItem | null>>;

export default function ShuffleScreen() {
  const colors = useColors();
  const { t, lang } = useLanguage();
  const insets = useSafeAreaInsets();
  const { items, markWorn, saveOutfit } = useWardrobe();
  const { temperature } = useWeather();

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [workMode, setWorkMode] = useState(false);
  const [locked, setLocked] = useState<Set<ClothingCategory>>(new Set());
  const [slots, setSlots] = useState<SlotMap>({});
  const [dislikedHashes, setDislikedHashes] = useState<Set<string>>(new Set());
  const [isShuffling, setIsShuffling] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [discoveryBannerVisible, setDiscoveryBannerVisible] = useState(false);
  const [tagline, setTagline] = useState<string | null>(null);

  const bannerOpacity = useRef(new Animated.Value(0)).current;
  const spinValues = useRef<Partial<Record<ClothingCategory, Animated.Value>>>(
    Object.fromEntries(SHUFFLE_SLOTS.map((s) => [s.key, new Animated.Value(0)]))
  ).current;

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(DISLIKED_KEY);
        if (stored) setDislikedHashes(new Set(JSON.parse(stored)));
      } catch {}
    })();
  }, []);

  // ── Climate-safe pool builder ───────────────────────────────────────────────
  const buildPool = useCallback(
    (category: ClothingCategory): ClothingItem[] => {
      const season = getCurrentSeason();
      const allowedWeights = getFabricWeightForTemp(temperature);
      return items.filter((item) => {
        if (item.category !== category) return false;
        if (!workMode && item.isWorkwear) return false;
        if (!item.seasons.includes(season)) return false;
        const fw = item.fabricWeight ?? "medium";
        if (!allowedWeights.includes(fw)) return false;
        if (category === "shoes" && temperature < SANDAL_TEMP_MIN && isSummerOnlyShoe(item))
          return false;
        return true;
      });
    },
    [items, workMode, temperature]
  );

  // ── Discovery engine core ──────────────────────────────────────────────────
  //
  // Three-pass selection:
  //   Pass 1 — base items (tops / bottoms): discovery-biased (low-wear first)
  //   Pass 2 — accent items (outerwear / accessories): complementary-contrast
  //            pick if base is neutral, otherwise discovery pick
  //   Pass 3 — shoes: discovery-biased from the climate-safe pool
  //
  // After each attempt: climate coherence check, then disliked-hash check.
  const doShuffle = useCallback(
    async (attempt = 0) => {
      if (attempt > 8) return;

      const newSlots: SlotMap = { ...slots };
      const unlockedSlots = SHUFFLE_SLOTS.filter((s) => !locked.has(s.key));

      // Pass 1: base items
      const baseCats: ClothingCategory[] = ["tops", "bottoms"];
      for (const slot of unlockedSlots.filter((s) => baseCats.includes(s.key))) {
        const pool = buildPool(slot.key);
        newSlots[slot.key] = pickDiscovery(pool);
      }

      // Determine if base is neutral → accent should add a colour pop
      const baseNeutral = slotBaseIsNeutral(newSlots);

      // Pass 2: accent items (outerwear, accessories)
      const accentCats: ClothingCategory[] = ["outerwear", "accessories"];
      for (const slot of unlockedSlots.filter((s) => accentCats.includes(s.key))) {
        const pool = buildPool(slot.key);
        newSlots[slot.key] = pickAccent(pool, baseNeutral);
      }

      // Pass 3: shoes (discovery-biased, climate-safe pool already pre-filters sandals)
      if (unlockedSlots.some((s) => s.key === "shoes")) {
        const pool = buildPool("shoes");
        newSlots["shoes"] = pickDiscovery(pool);
      }

      // Climate coherence guard
      if (!shuffleClimateOk(newSlots, temperature) && attempt < 8) {
        await doShuffle(attempt + 1);
        return;
      }

      // Skip disliked combos
      const hash = hashOutfit(newSlots);
      if (dislikedHashes.has(hash) && attempt < 8) {
        await doShuffle(attempt + 1);
        return;
      }

      setSlots(newSlots);
      setHasSaved(false);
    },
    [slots, locked, buildPool, dislikedHashes, temperature]
  );

  // ── Banner animation ───────────────────────────────────────────────────────
  const showDiscoveryBanner = useCallback(() => {
    setDiscoveryBannerVisible(true);
    Animated.sequence([
      Animated.timing(bannerOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(1600),
      Animated.timing(bannerOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setDiscoveryBannerVisible(false));
  }, [bannerOpacity]);

  // ── Shuffle handler ────────────────────────────────────────────────────────
  const handleShuffle = async () => {
    if (isShuffling) return;
    setIsShuffling(true);
    showDiscoveryBanner();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    const animations = SHUFFLE_SLOTS.filter((s) => !locked.has(s.key)).map((s) => {
      const val = spinValues[s.key]!;
      return Animated.sequence([
        Animated.timing(val, { toValue: 1, duration: 120, useNativeDriver: true }),
        Animated.timing(val, { toValue: 0, duration: 120, useNativeDriver: true }),
        Animated.timing(val, { toValue: 1, duration: 100, useNativeDriver: true }),
        Animated.timing(val, { toValue: 0, duration: 100, useNativeDriver: true }),
      ]);
    });

    Animated.parallel(animations).start();
    await doShuffle();
    setTagline(pickTagline(lang));

    setTimeout(() => {
      setIsShuffling(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, 450);
  };

  const toggleLock = (key: ClothingCategory) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLocked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleDislike = async () => {
    const hash = hashOutfit(slots);
    if (!hash) return;
    const next = new Set(dislikedHashes);
    next.add(hash);
    setDislikedHashes(next);
    await AsyncStorage.setItem(DISLIKED_KEY, JSON.stringify([...next]));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    handleShuffle();
  };

  const handleSave = async () => {
    const pieces = Object.entries(slots).filter(([, v]) => v) as [
      ClothingCategory,
      ClothingItem,
    ][];
    if (pieces.length === 0) return;
    const outfitMap = Object.fromEntries(pieces) as Partial<Record<ClothingCategory, ClothingItem>>;
    await saveOutfit("Lucky Shuffle", outfitMap);
    await markWorn(pieces.map(([, v]) => v.id));
    setHasSaved(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const filledCount = Object.values(slots).filter(Boolean).length;
  const season = getCurrentSeason();
  const allowedWeights = getFabricWeightForTemp(temperature);
  const hasAnyItems = SHUFFLE_SLOTS.some((s) => buildPool(s.key).length > 0);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
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
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            {t("lucky_shuffle")}
          </Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
            {temperature}° · {season.charAt(0).toUpperCase() + season.slice(1)} ·{" "}
            {allowedWeights.join(", ")} fabrics
          </Text>
        </View>
        <View style={styles.modeToggle}>
          <Feather
            name="briefcase"
            size={13}
            color={workMode ? colors.accent : colors.mutedForeground}
          />
          <Switch
            value={workMode}
            onValueChange={setWorkMode}
            thumbColor={workMode ? colors.accent : colors.border}
            trackColor={{ false: colors.secondary, true: colors.secondary }}
            style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
          />
          <Text
            style={[
              styles.modeLabel,
              { color: workMode ? colors.accent : colors.mutedForeground },
            ]}
          >
            Work
          </Text>
        </View>
      </View>

      {/* ── Scrollable content ─────────────────────────────────────────────── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Platform.OS === "web" ? 120 : insets.bottom + 120 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {!hasAnyItems ? (
          <View
            style={[
              styles.emptyState,
              { backgroundColor: colors.secondary, borderColor: colors.border },
            ]}
          >
            <Feather name="layers" size={36} color={colors.border} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              No items for this weather
            </Text>
            <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
              Add clothes with the right season and fabric weight to start shuffling.{"\n"}
              For {temperature}°: {allowedWeights.join(" / ")} fabrics, {season} season.
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/add-item")}
              style={[styles.addBtn, { backgroundColor: colors.primary }]}
            >
              <Feather name="plus" size={14} color={colors.primaryForeground} />
              <Text style={[styles.addBtnText, { color: colors.primaryForeground }]}>
                Add clothes
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
              {t("lucky_hint")} — surfaces rarely-worn pieces &amp; bold colour contrasts.
            </Text>

            {/* ── Discovery banner ─────────────────────────────────────────── */}
            {discoveryBannerVisible && (
              <Animated.View
                style={[
                  styles.discoveryBanner,
                  {
                    backgroundColor: colors.accent + "1A",
                    borderColor: colors.accent + "55",
                    opacity: bannerOpacity,
                  },
                ]}
              >
                <Feather name="zap" size={13} color={colors.accent} />
                <Text style={[styles.discoveryBannerText, { color: colors.accent }]}>
                  {t("lucky_discovery_banner")}
                </Text>
              </Animated.View>
            )}

            {/* ── Tagline badge ─────────────────────────────────────────── */}
            {tagline && filledCount > 0 && (
              <View
                style={[
                  styles.taglineBadge,
                  { borderColor: colors.accent + "55" },
                ]}
              >
                <View
                  style={[styles.taglineAccentBar, { backgroundColor: colors.accent }]}
                />
                <Text style={[styles.taglineText, { color: colors.accent }]}>
                  {tagline}
                </Text>
              </View>
            )}

            {/* ── Outfit slots ─────────────────────────────────────────────── */}
            {SHUFFLE_SLOTS.map((slot) => {
              const item = slots[slot.key];
              const isLocked = locked.has(slot.key);
              const pool = buildPool(slot.key);
              const spin = spinValues[slot.key]!;
              const translateY = spin.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -8],
              });

              return (
                <Animated.View
                  key={slot.key}
                  style={[
                    styles.slotRow,
                    {
                      backgroundColor: colors.card,
                      borderColor: isLocked ? colors.accent : colors.border,
                      transform: [{ translateY }],
                    },
                  ]}
                >
                  <View style={[styles.slotIcon, { backgroundColor: "#FFFFFF" }]}>
                    {item?.imageUri ? (
                      <Image
                        source={{ uri: item.imageUri }}
                        style={StyleSheet.absoluteFillObject}
                        contentFit="contain"
                      />
                    ) : item ? (
                      <Feather name={slot.icon} size={20} color="#C8B9AE" />
                    ) : (
                      <Feather name={slot.icon} size={20} color={colors.border} />
                    )}
                  </View>

                  <View style={styles.slotInfo}>
                    <Text style={[styles.slotCategory, { color: colors.mutedForeground }]}>
                      {slot.label.toUpperCase()}
                    </Text>
                    {item ? (
                      <>
                        <Text
                          style={[styles.slotItemName, { color: colors.foreground }]}
                          numberOfLines={1}
                        >
                          {item.name}
                        </Text>
                        <View style={styles.slotMeta}>
                          {/* colour swatch */}
                          <View
                            style={[
                              styles.colorDot,
                              { backgroundColor: item.colorHex },
                            ]}
                          />
                          <Text
                            style={[styles.slotMetaText, { color: colors.mutedForeground }]}
                          >
                            {item.color} · {item.fabricWeight ?? "medium"} ·{" "}
                            {item.timesWorn ?? 0}× worn
                          </Text>
                          {item.isWorkwear && (
                            <View
                              style={[
                                styles.workBadge,
                                { backgroundColor: colors.secondary },
                              ]}
                            >
                              <Feather name="briefcase" size={9} color={colors.accent} />
                            </View>
                          )}
                        </View>
                      </>
                    ) : (
                      <Text style={[styles.slotEmpty, { color: colors.border }]}>
                        {pool.length === 0 ? "No matching items" : "—"}
                      </Text>
                    )}
                  </View>

                  <TouchableOpacity
                    onPress={() => toggleLock(slot.key)}
                    style={[
                      styles.lockBtn,
                      {
                        backgroundColor: isLocked
                          ? colors.accent + "22"
                          : colors.secondary,
                      },
                    ]}
                  >
                    <Feather
                      name={isLocked ? "lock" : "unlock"}
                      size={16}
                      color={isLocked ? colors.accent : colors.border}
                    />
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </>
        )}
      </ScrollView>

      {/* ── Footer actions ─────────────────────────────────────────────────── */}
      {hasAnyItems && (
        <View
          style={[
            styles.footer,
            {
              backgroundColor: colors.background,
              borderTopColor: colors.border,
              paddingBottom: Platform.OS === "web" ? 20 : insets.bottom + 12,
            },
          ]}
        >
          {filledCount > 0 && (
            <View style={styles.footerActions}>
              <TouchableOpacity
                onPress={handleDislike}
                style={[
                  styles.rejectBtn,
                  { backgroundColor: colors.secondary, borderColor: colors.border },
                ]}
              >
                <Feather name="thumbs-down" size={16} color={colors.mutedForeground} />
                <Text style={[styles.rejectBtnText, { color: colors.mutedForeground }]}>
                  Never again
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSave}
                disabled={hasSaved}
                style={[
                  styles.saveBtn,
                  {
                    backgroundColor: colors.secondary,
                    borderColor: hasSaved ? colors.border : colors.accent,
                  },
                ]}
              >
                <Feather
                  name={hasSaved ? "check" : "bookmark"}
                  size={16}
                  color={hasSaved ? colors.border : colors.accent}
                />
                <Text
                  style={[
                    styles.saveBtnText,
                    { color: hasSaved ? colors.border : colors.accent },
                  ]}
                >
                  {hasSaved ? "Saved!" : "Save look"}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            onPress={handleShuffle}
            disabled={isShuffling}
            style={[
              styles.shuffleBtn,
              { backgroundColor: isShuffling ? colors.secondary : colors.primary },
            ]}
          >
            <Feather
              name="shuffle"
              size={20}
              color={isShuffling ? colors.mutedForeground : colors.primaryForeground}
            />
            <Text
              style={[
                styles.shuffleBtnText,
                { color: isShuffling ? colors.mutedForeground : colors.primaryForeground },
              ]}
            >
              {isShuffling
                ? "Discovering..."
                : locked.size > 0
                  ? `Shuffle (${SHUFFLE_SLOTS.length - locked.size} unlocked)`
                  : "Shuffle All"}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

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
  headerSub: { fontSize: 12, marginTop: 1 },
  modeToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  modeLabel: { fontSize: 12, fontWeight: "600" },
  content: {
    paddingHorizontal: 18,
    paddingTop: 16,
    gap: 10,
  },
  hint: { fontSize: 12, fontWeight: "500", marginBottom: 4 },
  discoveryBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 2,
  },
  discoveryBannerText: {
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
    fontStyle: "italic",
  },
  slotRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1.5,
    overflow: "hidden",
    height: 80,
  },
  slotIcon: {
    width: 80,
    height: 80,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    overflow: "hidden",
    position: "relative",
  },
  slotInfo: {
    flex: 1,
    paddingHorizontal: 14,
    gap: 2,
  },
  slotCategory: { fontSize: 9, fontWeight: "700", letterSpacing: 1 },
  slotItemName: { fontSize: 15, fontWeight: "600" },
  slotEmpty: { fontSize: 14, fontStyle: "italic" },
  slotMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  colorDot: { width: 10, height: 10, borderRadius: 5 },
  slotMetaText: { fontSize: 11 },
  workBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  lockBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  footer: {
    paddingHorizontal: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    gap: 10,
  },
  footerActions: {
    flexDirection: "row",
    gap: 10,
  },
  rejectBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  rejectBtnText: { fontSize: 13, fontWeight: "600" },
  saveBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  saveBtnText: { fontSize: 13, fontWeight: "600" },
  shuffleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
  },
  shuffleBtnText: { fontSize: 16, fontWeight: "700" },
  emptyState: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 28,
    alignItems: "center",
    gap: 10,
  },
  emptyTitle: { fontSize: 17, fontWeight: "700", marginTop: 4 },
  emptyBody: { fontSize: 13, textAlign: "center", lineHeight: 19 },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 100,
    marginTop: 6,
  },
  addBtnText: { fontSize: 14, fontWeight: "600" },
  taglineBadge: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 2,
  },
  taglineAccentBar: {
    width: 4,
    alignSelf: "stretch",
  },
  taglineText: {
    flex: 1,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});
