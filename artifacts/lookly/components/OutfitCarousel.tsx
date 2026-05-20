import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import { useWardrobe, type ClothingItem } from "@/contexts/WardrobeContext";
import { useWeather } from "@/contexts/WeatherContext";
import { useUserProfile } from "@/contexts/UserProfileContext";

const SCREEN_W = Dimensions.get("window").width;
const CARD_H = 500;
const API_BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

const MOOD_COLORS: Record<string, string> = {
  casual: "#C8906A",
  minimal: "#78716C",
  streetwear: "#1C1512",
  formal: "#1E3A5F",
  sporty: "#6B7C4D",
  boho: "#C19A6B",
  chic: "#800020",
};

interface OutfitItem {
  itemId: string;
  role: string;
}

interface Outfit {
  name: string;
  mood: string;
  weatherNote?: string | null;
  items: OutfitItem[];
}

function OutfitCard({
  outfit,
  wardrobeMap,
  temperature,
  weatherDesc,
  cardWidth,
  userBodyPhotoBase64,
  userBodyPhotoMime,
}: {
  outfit: Outfit;
  wardrobeMap: Map<string, ClothingItem>;
  temperature: number;
  weatherDesc: string;
  cardWidth: number;
  userBodyPhotoBase64: string | null;
  userBodyPhotoMime: string;
}) {
  const colors = useColors();
  const moodColor = MOOD_COLORS[outfit.mood] ?? colors.accent;
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genFailed, setGenFailed] = useState(false);
  const generated = useRef(false);

  const resolvedItems = outfit.items
    .map((oi) => wardrobeMap.get(oi.itemId))
    .filter((i): i is ClothingItem => !!i);

  useEffect(() => {
    if (generated.current || resolvedItems.length === 0) return;
    generated.current = true;
    setIsGenerating(true);

    const itemsForApi = resolvedItems.map((i) => ({
      name: i.name,
      color: i.color,
      colorHex: i.colorHex,
      category: i.category,
      ...(i.brandLogo ? { brandLogo: i.brandLogo } : {}),
    }));

    fetch(`${API_BASE}/outfit-preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: itemsForApi,
        weather: weatherDesc,
        temperature,
        ...(userBodyPhotoBase64
          ? { userBodyPhotoBase64, userBodyPhotoMime }
          : {}),
      }),
    })
      .then((r) => r.json())
      .then((data: { image?: string }) => {
        if (data.image) {
          setPreviewImage(`data:image/png;base64,${data.image}`);
        } else {
          setGenFailed(true);
        }
      })
      .catch(() => setGenFailed(true))
      .finally(() => setIsGenerating(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const imageAreaH = CARD_H - 72;

  return (
    <View
      style={[
        styles.card,
        { width: cardWidth, backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      {/* Image / loading area */}
      <View style={[styles.imageArea, { height: imageAreaH, backgroundColor: colors.secondary }]}>
        {previewImage ? (
          <Image
            source={{ uri: previewImage }}
            style={StyleSheet.absoluteFillObject}
            contentFit="contain"
            transition={400}
          />
        ) : isGenerating ? (
          <View style={styles.generatingOverlay}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={[styles.generatingText, { color: colors.mutedForeground }]}>
              Styling your look…
            </Text>
          </View>
        ) : genFailed || resolvedItems.length === 0 ? (
          <View style={styles.generatingOverlay}>
            <Feather name="image" size={32} color={colors.border} />
            <Text style={[styles.generatingText, { color: colors.mutedForeground }]}>
              {resolvedItems.length === 0
                ? "Add items to your wardrobe\nto see a styled look"
                : "Preview unavailable"}
            </Text>
          </View>
        ) : null}

        {/* Mood pill always visible over image */}
        <View style={[styles.moodPill, { backgroundColor: moodColor }]}>
          <Text style={styles.moodText}>{outfit.mood.toUpperCase()}</Text>
        </View>

        {/* Gradient scrim at bottom of image for readability */}
        {previewImage && (
          <View style={styles.imageScrim} pointerEvents="none" />
        )}
      </View>

      {/* Card footer */}
      <View style={styles.cardBody}>
        <View style={styles.cardInfo}>
          <Text style={[styles.outfitName, { color: colors.foreground }]} numberOfLines={1}>
            {outfit.name}
          </Text>
          <Text style={[styles.weatherNote, { color: colors.mutedForeground }]} numberOfLines={2}>
            {outfit.weatherNote ?? `${temperature}°C · ${weatherDesc}`}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push("/outfit-builder")}
          style={[styles.buildBtn, { backgroundColor: colors.primary }]}
        >
          <Feather name="scissors" size={13} color={colors.primaryForeground} />
          <Text style={[styles.buildBtnText, { color: colors.primaryForeground }]}>
            Build look
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function OutfitCarousel() {
  const colors = useColors();
  const { items } = useWardrobe();
  const { temperature, weatherCode, isLoading: weatherLoading } = useWeather();
  const { bodyPhotoBase64, bodyPhotoMime } = useUserProfile();
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const cardWidth = SCREEN_W - 36;
  const wDesc = weatherDescLabel(temperature, weatherCode);

  const fetchOutfits = useCallback(async () => {
    if (weatherLoading) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/suggest-outfits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, temperature, weatherCode }),
      });
      const data = (await res.json()) as { outfits: Outfit[] };
      setOutfits(data.outfits ?? []);
    } catch {
      setOutfits([]);
    } finally {
      setLoading(false);
    }
  }, [items.length, temperature, weatherCode, weatherLoading]);

  useEffect(() => {
    if (!weatherLoading) void fetchOutfits();
  }, [weatherLoading, fetchOutfits]);

  const wardrobeMap = new Map(items.map((i) => [i.id, i]));

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / cardWidth);
    setActiveIdx(idx);
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.sectionHeader}>
        <View>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
            TODAY'S LOOKS
          </Text>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Outfit Ideas</Text>
        </View>
        <TouchableOpacity onPress={fetchOutfits} disabled={loading} style={styles.refreshBtn}>
          {loading ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <Feather name="refresh-cw" size={15} color={colors.accent} />
          )}
        </TouchableOpacity>
      </View>

      {loading && outfits.length === 0 ? (
        <View
          style={[
            styles.skeleton,
            { backgroundColor: colors.card, borderColor: colors.border, height: CARD_H },
          ]}
        >
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.skeletonText, { color: colors.mutedForeground }]}>
            Styling your looks…
          </Text>
        </View>
      ) : outfits.length === 0 ? (
        <View
          style={[
            styles.skeleton,
            { backgroundColor: colors.card, borderColor: colors.border, height: CARD_H },
          ]}
        >
          <Feather name="layers" size={28} color={colors.border} />
          <Text style={[styles.skeletonText, { color: colors.mutedForeground }]}>
            Add items to your wardrobe to get outfit ideas
          </Text>
          <TouchableOpacity
            onPress={() => router.push("/add-item")}
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
          >
            <Feather name="plus" size={14} color={colors.primaryForeground} />
            <Text style={[styles.addBtnText, { color: colors.primaryForeground }]}>
              Add first item
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onScroll}
            decelerationRate="fast"
            snapToInterval={cardWidth + 12}
            snapToAlignment="start"
            contentContainerStyle={{ gap: 12, paddingRight: 18 }}
          >
            {outfits.map((outfit, i) => (
              <OutfitCard
                key={`${outfit.name}-${outfit.mood}-${outfit.items.map((x) => x.itemId).join("-")}`}
                outfit={outfit}
                wardrobeMap={wardrobeMap}
                temperature={temperature}
                weatherDesc={wDesc}
                cardWidth={cardWidth}
                userBodyPhotoBase64={bodyPhotoBase64}
                userBodyPhotoMime={bodyPhotoMime}
              />
            ))}
          </ScrollView>

          <View style={styles.dots}>
            {outfits.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i === activeIdx
                    ? { backgroundColor: colors.accent, width: 18 }
                    : { backgroundColor: colors.border, width: 6 },
                ]}
              />
            ))}
          </View>
        </>
      )}
    </View>
  );
}

function weatherDescLabel(temp: number, code: number): string {
  if (code >= 71 && code <= 77) return "snowy";
  if (code >= 61 && code <= 67) return "rainy";
  if (code >= 51 && code <= 57) return "drizzly";
  if (code === 0) return "sunny";
  if (code <= 1) return "clear";
  return temp > 28 ? "hot & sunny" : temp > 20 ? "warm" : temp > 12 ? "mild" : "cool";
}

const styles = StyleSheet.create({
  wrapper: { gap: 12 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  sectionTitle: { fontSize: 20, fontWeight: "700" },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  skeleton: {
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
  },
  skeletonText: {
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 20,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 12,
    marginTop: 4,
  },
  addBtnText: { fontSize: 14, fontWeight: "600" },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    height: CARD_H,
  },
  imageArea: {
    overflow: "hidden",
    position: "relative",
  },
  generatingOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
  },
  generatingText: {
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 18,
  },
  imageScrim: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: "rgba(28,21,18,0.25)",
  },
  moodPill: {
    position: "absolute",
    top: 12,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    zIndex: 1,
  },
  moodText: {
    color: "#FAF8F5",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
  },
  cardBody: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    height: 72,
  },
  cardInfo: { flex: 1 },
  outfitName: { fontSize: 16, fontWeight: "700", marginBottom: 3 },
  weatherNote: { fontSize: 12, fontWeight: "400" },
  buildBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    flexShrink: 0,
  },
  buildBtnText: { fontSize: 13, fontWeight: "600" },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 5,
  },
  dot: { height: 6, borderRadius: 3 },
});
