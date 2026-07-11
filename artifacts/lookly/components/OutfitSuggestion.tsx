import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { useWeather } from "@/contexts/WeatherContext";
import { type ClothingItem, type Season, useWardrobe } from "@/contexts/WardrobeContext";

function getCurrentSeason(): Season {
  const m = new Date().getMonth();
  if (m >= 2 && m <= 4) return "spring";
  if (m >= 5 && m <= 7) return "summer";
  if (m >= 8 && m <= 10) return "fall";
  return "winter";
}

interface GenericItem {
  category: string;
  suggestion: string;
  icon: React.ComponentProps<typeof Feather>["name"];
}

function getGenericSuggestion(temp: number, weatherCode: number): {
  headline: string;
  items: GenericItem[];
  palette: string[];
} {
  const isRain = weatherCode >= 51 && weatherCode <= 82;
  const isSnow = weatherCode >= 71 && weatherCode <= 77;
  if (isSnow || temp < 5)
    return {
      headline: "Bundle up warmly",
      items: [
        { category: "Outerwear", suggestion: "Wool coat or puffer jacket", icon: "layers" },
        { category: "Top", suggestion: "Thick knit turtleneck", icon: "wind" },
        { category: "Bottom", suggestion: "Lined trousers or thick jeans", icon: "minus" },
        { category: "Shoes", suggestion: "Boots or insulated footwear", icon: "chevrons-up" },
      ],
      palette: ["#D2B48C", "#1C1512", "#8B7355"],
    };
  if (temp < 12)
    return {
      headline: "Layer it up",
      items: [
        { category: "Outerwear", suggestion: "Trench coat or blazer", icon: "layers" },
        { category: "Top", suggestion: "Long sleeve shirt or light knit", icon: "wind" },
        { category: "Bottom", suggestion: "Straight leg jeans or trousers", icon: "minus" },
        { category: "Shoes", suggestion: "Ankle boots or loafers", icon: "chevrons-up" },
      ],
      palette: ["#8B7355", "#C8906A", "#F3EFE9"],
    };
  if (temp < 20)
    return {
      headline: "Light layers",
      items: [
        { category: "Outerwear", suggestion: "Light jacket or denim jacket", icon: "layers" },
        { category: "Top", suggestion: "T-shirt or light blouse", icon: "wind" },
        { category: "Bottom", suggestion: "Jeans or midi skirt", icon: "minus" },
        { category: "Shoes", suggestion: "Sneakers or loafers", icon: "chevrons-up" },
      ],
      palette: ["#C8906A", "#E8DDD4", "#78716C"],
    };
  if (temp < 28)
    return {
      headline: isRain ? "Rainy day chic" : "Effortless daytime",
      items: [
        {
          category: isRain ? "Outerwear" : "Top",
          suggestion: isRain ? "Lightweight raincoat" : "Linen shirt or cotton top",
          icon: "wind",
        },
        { category: "Bottom", suggestion: "Light trousers or midi skirt", icon: "minus" },
        { category: "Shoes", suggestion: isRain ? "Waterproof shoes" : "Mules or loafers", icon: "chevrons-up" },
        { category: "Accessory", suggestion: isRain ? "Compact umbrella" : "Sunglasses", icon: "sun" },
      ],
      palette: ["#F5DEB3", "#C8906A", "#FFFFFF"],
    };
  return {
    headline: "Beat the heat",
    items: [
      { category: "Top", suggestion: "Breathable linen or cotton", icon: "wind" },
      { category: "Bottom", suggestion: "Light shorts or flowy skirt", icon: "minus" },
      { category: "Shoes", suggestion: "Sandals or open-toe flats", icon: "chevrons-up" },
      { category: "Accessory", suggestion: "Sunhat & sunglasses", icon: "sun" },
    ],
    palette: ["#F9F8F6", "#E8C9A0", "#F5DEB3"],
  };
}

function WardrobeOutfitRow({ item, label }: { item: ClothingItem; label: string }) {
  const colors = useColors();
  return (
    <View style={[styles.wardrobeItem, { borderColor: colors.border }]}>
      <View style={[styles.wardrobeColor, { backgroundColor: item.colorHex }]} />
      <View style={styles.wardrobeText}>
        <Text style={[styles.itemCategory, { color: colors.mutedForeground }]}>{label}</Text>
        <Text style={[styles.itemSuggestion, { color: colors.foreground }]}>{item.name}</Text>
      </View>
      <View style={[styles.fromWardrobePill, { backgroundColor: colors.secondary }]}>
        <Feather name="check" size={10} color={colors.accent} />
        <Text style={[styles.fromWardrobeText, { color: colors.accent }]}>yours</Text>
      </View>
    </View>
  );
}

export default function OutfitSuggestion() {
  const colors = useColors();
  const { temperature, weatherCode, isLoading } = useWeather();
  const { items } = useWardrobe();

  if (isLoading) return null;

  const isRain = weatherCode >= 51 && weatherCode <= 82;
  const needsOuterwear = temperature < 20 || isRain;
  const season = getCurrentSeason();

  const seasonItems = items.filter((i) => i.seasons.includes(season));
  const top = seasonItems.find((i) => i.category === "tops");
  const bottom = seasonItems.find((i) => i.category === "bottoms");
  const dress = seasonItems.find((i) => i.category === "dresses");
  const outerwear = needsOuterwear ? seasonItems.find((i) => i.category === "outerwear") : null;
  const shoes = seasonItems.find((i) => i.category === "shoes");
  const accessory = seasonItems.find((i) => i.category === "accessories");

  const hasWardrobeItems = !!(top || bottom || dress || shoes);

  if (hasWardrobeItems) {
    const mainPieces: { item: ClothingItem; label: string }[] = [];
    if (outerwear) mainPieces.push({ item: outerwear, label: "Outerwear" });
    if (top && !dress) mainPieces.push({ item: top, label: "Top" });
    if (dress) mainPieces.push({ item: dress, label: "Dress" });
    if (bottom && !dress) mainPieces.push({ item: bottom, label: "Bottom" });
    if (shoes) mainPieces.push({ item: shoes, label: "Shoes" });
    if (accessory) mainPieces.push({ item: accessory, label: "Accessory" });

    const palette = mainPieces.slice(0, 4).map((p) => p.item.colorHex);

    const generic = getGenericSuggestion(temperature, weatherCode);

    return (
      <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <View style={styles.labelRow}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>TODAY'S OUTFIT</Text>
              <View style={[styles.fromWardrobeBadge, { backgroundColor: colors.accent }]}>
                <Feather name="layers" size={9} color={colors.primaryForeground} />
                <Text style={[styles.fromWardrobeBadgeText, { color: colors.primaryForeground }]}>From your wardrobe</Text>
              </View>
            </View>
            <Text style={[styles.headline, { color: colors.foreground }]}>{generic.headline}</Text>
          </View>
          <View style={styles.palette}>
            {palette.map((hex, i) => (
              <View
                key={i}
                style={[
                  styles.swatch,
                  {
                    backgroundColor: hex,
                    borderColor: colors.background,
                    marginLeft: i > 0 ? -6 : 0,
                  },
                ]}
              />
            ))}
          </View>
        </View>

        <View style={styles.items}>
          {mainPieces.map(({ item, label }) => (
            <WardrobeOutfitRow key={item.id} item={item} label={label} />
          ))}
        </View>

        <TouchableOpacity
          onPress={() => router.push("/outfit-builder")}
          style={[styles.buildBtn, { backgroundColor: colors.primary }]}
        >
          <Feather name="scissors" size={14} color={colors.primaryForeground} />
          <Text style={[styles.buildBtnText, { color: colors.primaryForeground }]}>
            Make your own look
          </Text>
          <Feather name="arrow-right" size={14} color={colors.primaryForeground} />
        </TouchableOpacity>
      </View>
    );
  }

  const suggestion = getGenericSuggestion(temperature, weatherCode);

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>TODAY'S OUTFIT IDEA</Text>
          <Text style={[styles.headline, { color: colors.foreground }]}>{suggestion.headline}</Text>
        </View>
        <View style={styles.palette}>
          {suggestion.palette.map((hex, i) => (
            <View
              key={i}
              style={[
                styles.swatch,
                { backgroundColor: hex, borderColor: colors.border, marginLeft: i > 0 ? -6 : 0 },
              ]}
            />
          ))}
        </View>
      </View>
      <View style={styles.items}>
        {suggestion.items.map((item, i) => (
          <View key={i} style={[styles.item, { borderColor: colors.border }]}>
            <View style={[styles.iconWrap, { backgroundColor: colors.secondary }]}>
              <Feather name={item.icon} size={14} color={colors.accent} />
            </View>
            <View style={styles.itemText}>
              <Text style={[styles.itemCategory, { color: colors.mutedForeground }]}>
                {item.category}
              </Text>
              <Text style={[styles.itemSuggestion, { color: colors.foreground }]}>
                {item.suggestion}
              </Text>
            </View>
          </View>
        ))}
      </View>
      <TouchableOpacity
        onPress={() => router.push("/outfit-builder")}
        style={[styles.buildBtn, { backgroundColor: colors.secondary }]}
      >
        <Feather name="scissors" size={14} color={colors.foreground} />
        <Text style={[styles.buildBtnText, { color: colors.foreground }]}>
          Make your own look
        </Text>
        <Feather name="arrow-right" size={14} color={colors.mutedForeground} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    gap: 14,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 3,
  },
  label: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  fromWardrobeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  fromWardrobeBadgeText: {
    fontSize: 9,
    fontWeight: "700",
  },
  headline: {
    fontSize: 18,
    fontWeight: "700",
  },
  palette: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    flexShrink: 0,
  },
  swatch: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
  },
  items: {
    gap: 8,
  },
  wardrobeItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  wardrobeColor: {
    width: 36,
    height: 36,
    borderRadius: 8,
    flexShrink: 0,
  },
  wardrobeText: {
    flex: 1,
  },
  fromWardrobePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 20,
  },
  fromWardrobeText: {
    fontSize: 10,
    fontWeight: "600",
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  itemText: {
    flex: 1,
  },
  itemCategory: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 1,
  },
  itemSuggestion: {
    fontSize: 14,
    fontWeight: "500",
  },
  buildBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  buildBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
