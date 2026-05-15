import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { useWeather } from "@/contexts/WeatherContext";

interface SuggestionItem {
  category: string;
  suggestion: string;
  icon: React.ComponentProps<typeof Feather>["name"];
}

function getOutfitSuggestion(temp: number, weatherCode: number): {
  headline: string;
  items: SuggestionItem[];
  palette: string[];
} {
  const isRain = weatherCode >= 51 && weatherCode <= 82;
  const isSnow = weatherCode >= 71 && weatherCode <= 77;

  if (isSnow || temp < 5) {
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
  }
  if (temp < 12) {
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
  }
  if (temp < 20) {
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
  }
  if (temp < 28) {
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
  }
  return {
    headline: "Beat the heat",
    items: [
      { category: "Top", suggestion: "Breathable linen or cotton", icon: "wind" },
      { category: "Bottom", suggestion: "Light shorts or flowy skirt", icon: "minus" },
      { category: "Shoes", suggestion: "Sandals or open-toe flats", icon: "chevrons-up" },
      { category: "Accessory", suggestion: "Sunhat & sunglasses", icon: "sun" },
    ],
    palette: ["#FAF8F5", "#E8C9A0", "#F5DEB3"],
  };
}

export default function OutfitSuggestion() {
  const colors = useColors();
  const { temperature, weatherCode, isLoading } = useWeather();

  if (isLoading) return null;

  const suggestion = getOutfitSuggestion(temperature, weatherCode);

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
  },
  label: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
    marginBottom: 3,
  },
  headline: {
    fontSize: 18,
    fontWeight: "700",
  },
  palette: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
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
});
