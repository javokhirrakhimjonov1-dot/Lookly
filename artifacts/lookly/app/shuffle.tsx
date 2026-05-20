import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
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
import {
  type ClothingCategory,
  type ClothingItem,
  type FabricWeight,
  type Season,
  useWardrobe,
} from "@/contexts/WardrobeContext";
import { useWeather } from "@/contexts/WeatherContext";

const SHUFFLE_SLOTS: { key: ClothingCategory; label: string; icon: React.ComponentProps<typeof Feather>["name"] }[] = [
  { key: "outerwear", label: "Outerwear", icon: "layers" },
  { key: "tops", label: "Top", icon: "wind" },
  { key: "bottoms", label: "Bottom", icon: "minus" },
  { key: "shoes", label: "Shoes", icon: "chevrons-up" },
  { key: "accessories", label: "Accessory", icon: "circle" },
];

const DISLIKED_KEY = "@lookly_disliked_outfits";

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

function isLight(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}

function pickRandom<T>(arr: T[]): T | null {
  if (arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)] ?? null;
}

type SlotMap = Partial<Record<ClothingCategory, ClothingItem | null>>;

export default function ShuffleScreen() {
  const colors = useColors();
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

  const buildPool = useCallback(
    (category: ClothingCategory): ClothingItem[] => {
      const season = getCurrentSeason();
      const allowedWeights = getFabricWeightForTemp(temperature);
      return items.filter((item) => {
        if (item.category !== category) return false;
        if (workMode ? !item.isWorkwear && item.isWorkwear : item.isWorkwear && !workMode) {
          // in casual mode, prefer non-workwear; in work mode, include workwear
        }
        if (!workMode && item.isWorkwear) return false;
        if (!item.seasons.includes(season)) return false;
        const fw = item.fabricWeight ?? "medium";
        if (!allowedWeights.includes(fw)) return false;
        return true;
      });
    },
    [items, workMode, temperature]
  );

  const doShuffle = useCallback(
    async (attempt = 0) => {
      if (attempt > 6) return;

      const newSlots: SlotMap = { ...slots };
      const unlockedSlots = SHUFFLE_SLOTS.filter((s) => !locked.has(s.key));

      for (const slot of unlockedSlots) {
        const pool = buildPool(slot.key);
        const picked = pickRandom(pool);
        newSlots[slot.key] = picked;
      }

      const hash = hashOutfit(newSlots);
      if (dislikedHashes.has(hash) && attempt < 6) {
        await doShuffle(attempt + 1);
        return;
      }

      setSlots(newSlots);
      setHasSaved(false);
    },
    [slots, locked, buildPool, dislikedHashes]
  );

  const handleShuffle = async () => {
    if (isShuffling) return;
    setIsShuffling(true);
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
    const pieces = Object.entries(slots).filter(([, v]) => v) as [ClothingCategory, ClothingItem][];
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
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Lucky Shuffle</Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
            {temperature}° · {season.charAt(0).toUpperCase() + season.slice(1)} · {allowedWeights.join(", ")} fabrics
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
          <Text style={[styles.modeLabel, { color: workMode ? colors.accent : colors.mutedForeground }]}>
            Work
          </Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Platform.OS === "web" ? 120 : insets.bottom + 120 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {!hasAnyItems ? (
          <View style={[styles.emptyState, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
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
              <Text style={[styles.addBtnText, { color: colors.primaryForeground }]}>Add clothes</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
              Each shuffle picks random items from your wardrobe that match today's weather and season. Lock any item you want to keep, then shuffle the rest.
            </Text>

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
                  <View style={[styles.slotIcon, { backgroundColor: item?.imageUri ? "#F5F3F0" : item ? item.colorHex : colors.secondary }]}>
                    {item?.imageUri ? (
                      <Image
                        source={{ uri: item.imageUri }}
                        style={StyleSheet.absoluteFillObject}
                        contentFit="contain"
                      />
                    ) : (
                      <Feather
                        name={slot.icon}
                        size={20}
                        color={
                          item
                            ? isLight(item.colorHex)
                              ? "rgba(28,21,18,0.5)"
                              : "rgba(250,248,245,0.5)"
                            : colors.border
                        }
                      />
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
                          <View
                            style={[styles.colorDot, { backgroundColor: item.colorHex }]}
                          />
                          <Text style={[styles.slotMetaText, { color: colors.mutedForeground }]}>
                            {item.color} · {item.fabricWeight ?? "medium"}
                          </Text>
                          {item.isWorkwear && (
                            <View style={[styles.workBadge, { backgroundColor: colors.secondary }]}>
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
                        backgroundColor: isLocked ? colors.accent + "22" : colors.secondary,
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
                style={[styles.rejectBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
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
                    backgroundColor: hasSaved ? colors.secondary : colors.secondary,
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
              {isShuffling ? "Shuffling..." : locked.size > 0 ? `Shuffle (${SHUFFLE_SLOTS.length - locked.size} unlocked)` : "Shuffle All"}
            </Text>
          </TouchableOpacity>
        </View>
      )}
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
});
