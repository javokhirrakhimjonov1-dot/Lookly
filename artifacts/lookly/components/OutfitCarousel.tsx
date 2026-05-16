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

const SCREEN_W = Dimensions.get("window").width;
const CARD_H = 340;
const API_BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

const CATEGORY_ICONS: Record<string, React.ComponentProps<typeof Feather>["name"]> = {
  tops: "wind",
  bottoms: "minus",
  dresses: "star",
  outerwear: "layers",
  shoes: "chevrons-up",
  accessories: "circle",
};

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
  items: OutfitItem[];
}

function isLight(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}

function ItemTile({ item }: { item: ClothingItem }) {
  const colors = useColors();
  return (
    <View style={[styles.itemTile, { backgroundColor: item.colorHex }]}>
      {item.imageUri ? (
        <Image
          source={{ uri: item.imageUri }}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
          transition={150}
        />
      ) : (
        <Feather
          name={CATEGORY_ICONS[item.category] ?? "circle"}
          size={20}
          color={isLight(item.colorHex) ? "rgba(28,21,18,0.45)" : "rgba(250,248,245,0.55)"}
        />
      )}
      <View style={styles.tileLabelWrap}>
        <Text style={styles.tileLabel} numberOfLines={1}>
          {item.name}
        </Text>
      </View>
    </View>
  );
}

function GenericTile({ role, colors }: { role: string; colors: ReturnType<typeof useColors> }) {
  const icon: React.ComponentProps<typeof Feather>["name"] =
    role === "top" ? "wind"
    : role === "bottom" ? "minus"
    : role === "outerwear" ? "layers"
    : role === "shoes" ? "chevrons-up"
    : role === "dress" ? "star"
    : "circle";
  return (
    <View style={[styles.itemTile, { backgroundColor: colors.secondary }]}>
      <Feather name={icon} size={20} color={colors.mutedForeground} />
      <View style={styles.tileLabelWrap}>
        <Text style={[styles.tileLabel, { color: colors.mutedForeground }]} numberOfLines={1}>
          {role}
        </Text>
      </View>
    </View>
  );
}

function OutfitCard({
  outfit,
  wardrobeMap,
  temperature,
  weatherDesc,
  cardWidth,
}: {
  outfit: Outfit;
  wardrobeMap: Map<string, ClothingItem>;
  temperature: number;
  weatherDesc: string;
  cardWidth: number;
}) {
  const colors = useColors();
  const moodColor = MOOD_COLORS[outfit.mood] ?? colors.accent;
  const resolvedItems = outfit.items
    .map((oi) => ({ wardrobeItem: wardrobeMap.get(oi.itemId), role: oi.role }))
    .slice(0, 4);

  const gridItems = resolvedItems.slice(0, 4);
  while (gridItems.length < 2) gridItems.push({ wardrobeItem: undefined, role: "accessory" });

  return (
    <View style={[styles.card, { width: cardWidth, backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.collage, { backgroundColor: colors.secondary }]}>
        <View style={styles.collageGrid}>
          {gridItems.slice(0, 4).map((gi, idx) =>
            gi.wardrobeItem ? (
              <ItemTile key={idx} item={gi.wardrobeItem} />
            ) : (
              <GenericTile key={idx} role={gi.role} colors={colors} />
            )
          )}
          {gridItems.length === 1 && <View style={styles.itemTilePlaceholder} />}
        </View>

        <View style={[styles.moodPill, { backgroundColor: moodColor }]}>
          <Text style={styles.moodText}>{outfit.mood.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.cardInfo}>
          <Text style={[styles.outfitName, { color: colors.foreground }]} numberOfLines={1}>
            {outfit.name}
          </Text>
          <Text style={[styles.weatherNote, { color: colors.mutedForeground }]}>
            {temperature}°C · {weatherDesc}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push("/outfit-builder")}
          style={[styles.buildBtn, { backgroundColor: colors.primary }]}
        >
          <Feather name="scissors" size={13} color={colors.primaryForeground} />
          <Text style={[styles.buildBtnText, { color: colors.primaryForeground }]}>Build look</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function OutfitCarousel() {
  const colors = useColors();
  const { items } = useWardrobe();
  const { temperature, weatherCode, isLoading: weatherLoading } = useWeather();
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const cardWidth = SCREEN_W - 36;

  const wDesc = weatherDesc(temperature, weatherCode);

  const fetchOutfits = useCallback(async () => {
    if (weatherLoading) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/suggest-outfits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, temperature, weatherCode }),
      });
      const data = await res.json() as { outfits: Outfit[] };
      setOutfits(data.outfits ?? []);
    } catch {
      setOutfits([]);
    } finally {
      setLoading(false);
    }
  }, [items.length, temperature, weatherCode, weatherLoading]);

  useEffect(() => {
    if (!weatherLoading) {
      void fetchOutfits();
    }
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
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>TODAY'S LOOKS</Text>
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
        <View style={[styles.skeleton, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.skeletonText, { color: colors.mutedForeground }]}>
            Styling your looks…
          </Text>
        </View>
      ) : outfits.length === 0 ? (
        <View style={[styles.skeleton, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="layers" size={28} color={colors.border} />
          <Text style={[styles.skeletonText, { color: colors.mutedForeground }]}>
            Add items to your wardrobe to get outfit ideas
          </Text>
          <TouchableOpacity onPress={() => router.push("/add-item")} style={[styles.addBtn, { backgroundColor: colors.primary }]}>
            <Feather name="plus" size={14} color={colors.primaryForeground} />
            <Text style={[styles.addBtnText, { color: colors.primaryForeground }]}>Add first item</Text>
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
                key={i}
                outfit={outfit}
                wardrobeMap={wardrobeMap}
                temperature={temperature}
                weatherDesc={wDesc}
                cardWidth={cardWidth}
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

function weatherDesc(temp: number, code: number): string {
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
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  skeleton: {
    height: CARD_H,
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
  collage: {
    flex: 1,
    overflow: "hidden",
  },
  collageGrid: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  itemTile: {
    width: "50%",
    height: "50%",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  itemTilePlaceholder: {
    width: "50%",
    height: "50%",
  },
  tileLabelWrap: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(28,21,18,0.52)",
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  tileLabel: {
    color: "#FAF8F5",
    fontSize: 10,
    fontWeight: "600",
  },
  moodPill: {
    position: "absolute",
    top: 12,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
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
  dot: {
    height: 6,
    borderRadius: 3,
  },
});
