import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useWardrobe, type ClothingItem, type FabricWeight } from "@/contexts/WardrobeContext";

interface DailyForecast {
  date: string;
  tempMax: number;
  tempMin: number;
  precipitation: number;
}

type TempTier = "freezing" | "cold" | "cool" | "mild" | "warm" | "hot";

function getTier(temp: number): TempTier {
  if (temp <= 0) return "freezing";
  if (temp <= 10) return "cold";
  if (temp <= 17) return "cool";
  if (temp <= 24) return "mild";
  if (temp <= 30) return "warm";
  return "hot";
}

const TIER_LABEL: Record<TempTier, string> = {
  freezing: "Below 0°C — heavy winter gear",
  cold: "0–10°C — warm outerwear needed",
  cool: "10–17°C — light jacket days",
  mild: "17–24°C — comfortable layering",
  warm: "24–30°C — light fabrics",
  hot: "Above 30°C — summer essentials only",
};

interface PackingCategory {
  category: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  needed: number;
  reason: string;
  fromWardrobe: ClothingItem[];
  needToBuy: string[];
}

function generatePackingList(
  days: number,
  forecasts: DailyForecast[],
  wardrobe: ClothingItem[],
  hasRain: boolean
): PackingCategory[] {
  const avgHigh = forecasts.reduce((s, d) => s + d.tempMax, 0) / forecasts.length;
  const avgLow = forecasts.reduce((s, d) => s + d.tempMin, 0) / forecasts.length;
  const dominantTier = getTier((avgHigh + avgLow) / 2);
  const needsOuterwear = avgLow <= 17;
  const needsHeavy = avgLow <= 10;
  const isHot = avgHigh > 28;

  const weightFilter = (item: ClothingItem): boolean => {
    if (isHot && item.fabricWeight === "heavy") return false;
    if (needsHeavy && item.fabricWeight === "light") return false;
    return true;
  };

  const topsNeeded = Math.ceil(days * 1.2);
  const bottomsNeeded = Math.max(2, Math.ceil(days * 0.6));
  const shoesNeeded = Math.min(3, Math.max(1, Math.ceil(days / 3)));
  const outerNeeded = needsOuterwear ? Math.min(2, Math.ceil(days / 4)) : 0;

  const topItems = wardrobe.filter((i) => i.category === "tops" && weightFilter(i));
  const bottomItems = wardrobe.filter((i) => i.category === "bottoms" && weightFilter(i));
  const dressItems = wardrobe.filter((i) => i.category === "dresses" && weightFilter(i));
  const outerItems = wardrobe.filter((i) => i.category === "outerwear");
  const shoeItems = wardrobe.filter((i) => i.category === "shoes");
  const accessItems = wardrobe.filter((i) => i.category === "accessories");

  const result: PackingCategory[] = [];

  result.push({
    category: "Tops",
    icon: "wind",
    needed: topsNeeded,
    reason: `${topsNeeded} tops for ${days} days at ${Math.round(avgHigh)}°C avg`,
    fromWardrobe: topItems.slice(0, topsNeeded),
    needToBuy: topItems.length < topsNeeded
      ? Array(topsNeeded - topItems.length).fill(isHot ? "Lightweight breathable top" : needsHeavy ? "Warm knit top" : "Casual layering top")
      : [],
  });

  result.push({
    category: "Bottoms",
    icon: "minus",
    needed: bottomsNeeded,
    reason: `${bottomsNeeded} bottoms including ${dressItems.length > 0 ? "dresses" : "trousers/jeans"}`,
    fromWardrobe: [...bottomItems, ...dressItems].slice(0, bottomsNeeded),
    needToBuy: (bottomItems.length + dressItems.length) < bottomsNeeded
      ? Array(bottomsNeeded - bottomItems.length - dressItems.length).fill(isHot ? "Light trousers / skirt" : "Comfortable jeans")
      : [],
  });

  if (needsOuterwear && outerNeeded > 0) {
    result.push({
      category: "Outerwear",
      icon: "layers",
      needed: outerNeeded,
      reason: needsHeavy ? "Heavy coat required — lows below 10°C" : "Light jacket for cool evenings",
      fromWardrobe: outerItems.slice(0, outerNeeded),
      needToBuy: outerItems.length < outerNeeded
        ? [needsHeavy ? "Heavy winter coat" : "Light jacket or cardigan"]
        : [],
    });
  }

  result.push({
    category: "Shoes",
    icon: "chevrons-up",
    needed: shoesNeeded,
    reason: `${shoesNeeded} pairs — ${isHot ? "sandals/sneakers for heat" : "closed-toe for cooler temps"}`,
    fromWardrobe: shoeItems.slice(0, shoesNeeded),
    needToBuy: shoeItems.length < shoesNeeded
      ? Array(shoesNeeded - shoeItems.length).fill(isHot ? "Comfortable sandals" : "Versatile sneakers")
      : [],
  });

  if (hasRain) {
    result.push({
      category: "Rain Gear",
      icon: "cloud-rain",
      needed: 1,
      reason: "Precipitation forecast — pack a rain layer",
      fromWardrobe: outerItems.filter((i) => i.tags?.includes("waterproof") || i.name.toLowerCase().includes("rain")).slice(0, 1),
      needToBuy: [],
    });
  }

  result.push({
    category: "Accessories",
    icon: "circle",
    needed: Math.min(accessItems.length, 3),
    reason: "Scarves, belts, bags for variety",
    fromWardrobe: accessItems.slice(0, 3),
    needToBuy: accessItems.length === 0 ? ["Versatile belt or scarf"] : [],
  });

  return result;
}

export default function PackTripScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { items: wardrobe } = useWardrobe();

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [city, setCity] = useState("");
  const [days, setDays] = useState("7");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forecasts, setForecasts] = useState<DailyForecast[] | null>(null);
  const [packingList, setPackingList] = useState<PackingCategory[] | null>(null);
  const [resolvedCity, setResolvedCity] = useState("");

  const handleGenerate = async () => {
    if (!city.trim()) { setError("Enter a destination city"); return; }
    const numDays = parseInt(days, 10);
    if (isNaN(numDays) || numDays < 1 || numDays > 16) {
      setError("Trip length must be 1–16 days");
      return;
    }
    setError(null);
    setIsLoading(true);
    setForecasts(null);
    setPackingList(null);

    try {
      const geoRes = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city.trim())}&count=1&language=en&format=json`
      );
      const geoData = await geoRes.json() as { results?: { name: string; latitude: number; longitude: number; country: string }[] };

      if (!geoData.results || geoData.results.length === 0) {
        setError(`Could not find "${city.trim()}". Try a different spelling.`);
        return;
      }
      const place = geoData.results[0]!;
      setResolvedCity(`${place.name}, ${place.country}`);

      const forecastRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}` +
        `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto&forecast_days=${Math.min(numDays, 16)}`
      );
      const forecastData = await forecastRes.json() as {
        daily: {
          time: string[];
          temperature_2m_max: number[];
          temperature_2m_min: number[];
          precipitation_sum: number[];
        };
      };

      const daily = forecastData.daily;
      const parsed: DailyForecast[] = daily.time.map((date, i) => ({
        date,
        tempMax: daily.temperature_2m_max[i]!,
        tempMin: daily.temperature_2m_min[i]!,
        precipitation: daily.precipitation_sum[i]!,
      }));

      const hasRain = parsed.some((d) => d.precipitation > 1);
      const list = generatePackingList(numDays, parsed, wardrobe, hasRain);

      setForecasts(parsed);
      setPackingList(list);
    } catch {
      setError("Could not fetch weather. Check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const avgHigh = forecasts ? Math.round(forecasts.reduce((s, d) => s + d.tempMax, 0) / forecasts.length) : null;
  const avgLow = forecasts ? Math.round(forecasts.reduce((s, d) => s + d.tempMin, 0) / forecasts.length) : null;
  const dominantTier = avgHigh != null && avgLow != null ? getTier((avgHigh + avgLow) / 2) : null;
  const totalPacked = packingList?.reduce((s, c) => s + c.fromWardrobe.length, 0) ?? 0;
  const totalToBuy = packingList?.reduce((s, c) => s + c.needToBuy.length, 0) ?? 0;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 16, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.headerLabel, { color: colors.mutedForeground }]}>PACKING UTILITY</Text>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Pack for Trip</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Platform.OS === "web" ? 80 : insets.bottom + 80 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Input card */}
        <View style={[styles.inputCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.inputTitle, { color: colors.foreground }]}>Where are you going?</Text>
          <Text style={[styles.inputSub, { color: colors.mutedForeground }]}>
            We'll pull the real weather forecast and match your wardrobe to it
          </Text>

          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>DESTINATION CITY</Text>
            <View style={[styles.inputRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <Feather name="map-pin" size={16} color={colors.mutedForeground} />
              <TextInput
                style={[styles.textInput, { color: colors.foreground }]}
                value={city}
                onChangeText={setCity}
                placeholder="e.g. Dubai, Istanbul, Paris…"
                placeholderTextColor={colors.mutedForeground}
                returnKeyType="next"
                autoCorrect={false}
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>TRIP LENGTH (DAYS)</Text>
            <View style={[styles.inputRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <Feather name="calendar" size={16} color={colors.mutedForeground} />
              <TextInput
                style={[styles.textInput, { color: colors.foreground }]}
                value={days}
                onChangeText={setDays}
                placeholder="7"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="number-pad"
                maxLength={2}
                returnKeyType="done"
              />
              <Text style={[styles.daysLabel, { color: colors.mutedForeground }]}>days</Text>
            </View>
          </View>

          {error && (
            <View style={styles.errorRow}>
              <Feather name="alert-circle" size={14} color="#DC2626" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            onPress={handleGenerate}
            disabled={isLoading}
            style={[styles.generateBtn, { backgroundColor: colors.primary, opacity: isLoading ? 0.7 : 1 }]}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : (
              <Feather name="zap" size={16} color={colors.primaryForeground} />
            )}
            <Text style={[styles.generateBtnText, { color: colors.primaryForeground }]}>
              {isLoading ? "Checking forecast…" : "Generate packing list"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Forecast summary */}
        {forecasts && dominantTier && (
          <View style={[styles.forecastCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.forecastHeader}>
              <View>
                <Text style={[styles.forecastCity, { color: colors.foreground }]}>{resolvedCity}</Text>
                <Text style={[styles.forecastRange, { color: colors.mutedForeground }]}>
                  {avgLow}° – {avgHigh}°C avg · {forecasts.length} day forecast
                </Text>
              </View>
              <View style={[styles.tierBadge, { backgroundColor: colors.accent + "22" }]}>
                <Text style={[styles.tierText, { color: colors.accent }]}>
                  {dominantTier.charAt(0).toUpperCase() + dominantTier.slice(1)}
                </Text>
              </View>
            </View>
            <Text style={[styles.tierDesc, { color: colors.mutedForeground }]}>{TIER_LABEL[dominantTier]}</Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.forecastStrip}>
              {forecasts.slice(0, 7).map((d) => (
                <View key={d.date} style={[styles.forecastDay, { backgroundColor: colors.secondary }]}>
                  <Text style={[styles.forecastDayName, { color: colors.mutedForeground }]}>
                    {new Date(d.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" })}
                  </Text>
                  <Text style={[styles.forecastHigh, { color: colors.foreground }]}>{Math.round(d.tempMax)}°</Text>
                  <Text style={[styles.forecastLow, { color: colors.mutedForeground }]}>{Math.round(d.tempMin)}°</Text>
                  {d.precipitation > 1 && (
                    <Feather name="cloud-rain" size={10} color="#3B82F6" />
                  )}
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Packing list */}
        {packingList && (
          <>
            <View style={styles.packSummaryRow}>
              <View style={[styles.packStat, { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" }]}>
                <Text style={[styles.packStatNum, { color: "#059669" }]}>{totalPacked}</Text>
                <Text style={[styles.packStatLabel, { color: "#059669" }]}>from wardrobe</Text>
              </View>
              {totalToBuy > 0 && (
                <View style={[styles.packStat, { backgroundColor: "#FEF9EC", borderColor: "#FDE68A" }]}>
                  <Text style={[styles.packStatNum, { color: "#D97706" }]}>{totalToBuy}</Text>
                  <Text style={[styles.packStatLabel, { color: "#D97706" }]}>to buy / consider</Text>
                </View>
              )}
            </View>

            {packingList.map((cat) => (
              <View
                key={cat.category}
                style={[styles.packCat, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={styles.packCatHeader}>
                  <View style={[styles.packIconWrap, { backgroundColor: colors.accent + "22" }]}>
                    <Feather name={cat.icon} size={15} color={colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.packCatTitle, { color: colors.foreground }]}>{cat.category}</Text>
                    <Text style={[styles.packCatReason, { color: colors.mutedForeground }]}>{cat.reason}</Text>
                  </View>
                  <View style={[styles.neededBadge, { backgroundColor: colors.secondary }]}>
                    <Text style={[styles.neededNum, { color: colors.foreground }]}>{cat.needed}</Text>
                  </View>
                </View>

                {cat.fromWardrobe.length > 0 && (
                  <View style={styles.wardrobeMatches}>
                    <Text style={[styles.matchesLabel, { color: colors.mutedForeground }]}>FROM YOUR WARDROBE</Text>
                    {cat.fromWardrobe.map((item) => (
                      <View key={item.id} style={[styles.itemRow, { backgroundColor: colors.secondary }]}>
                        <View style={[styles.itemSwatch, { backgroundColor: item.colorHex }]} />
                        <Text style={[styles.itemName, { color: colors.foreground }]} numberOfLines={1}>{item.name}</Text>
                        <View style={[styles.checkBadge, { backgroundColor: "#F0FDF4" }]}>
                          <Feather name="check" size={10} color="#059669" />
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {cat.needToBuy.length > 0 && (
                  <View style={styles.toBuyList}>
                    <Text style={[styles.matchesLabel, { color: "#D97706" }]}>CONSIDER PACKING</Text>
                    {cat.needToBuy.map((item, i) => (
                      <View key={i} style={[styles.itemRow, { backgroundColor: "#FEF9EC" }]}>
                        <Feather name="shopping-bag" size={12} color="#D97706" />
                        <Text style={[styles.itemName, { color: "#92400E" }]} numberOfLines={1}>{item}</Text>
                      </View>
                    ))}
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
  fieldGroup: { gap: 7 },
  fieldLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.8 },
  inputRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11,
  },
  textInput: { flex: 1, fontSize: 15, fontWeight: "500" },
  daysLabel: { fontSize: 13 },
  errorRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  errorText: { color: "#DC2626", fontSize: 13 },
  generateBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 14, borderRadius: 14,
  },
  generateBtnText: { fontSize: 15, fontWeight: "700" },
  forecastCard: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 12 },
  forecastHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  forecastCity: { fontSize: 18, fontWeight: "700" },
  forecastRange: { fontSize: 13, marginTop: 2 },
  tierBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  tierText: { fontSize: 12, fontWeight: "700" },
  tierDesc: { fontSize: 12, lineHeight: 17 },
  forecastStrip: { gap: 8 },
  forecastDay: { alignItems: "center", gap: 3, paddingHorizontal: 10, paddingVertical: 10, borderRadius: 12, minWidth: 52 },
  forecastDayName: { fontSize: 10, fontWeight: "600" },
  forecastHigh: { fontSize: 16, fontWeight: "800" },
  forecastLow: { fontSize: 12 },
  packSummaryRow: { flexDirection: "row", gap: 10 },
  packStat: {
    flex: 1, alignItems: "center", padding: 14, borderRadius: 14, borderWidth: 1, gap: 2,
  },
  packStatNum: { fontSize: 26, fontWeight: "800" },
  packStatLabel: { fontSize: 11, fontWeight: "600" },
  packCat: { borderRadius: 18, borderWidth: 1, padding: 14, gap: 12 },
  packCatHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  packIconWrap: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  packCatTitle: { fontSize: 15, fontWeight: "700" },
  packCatReason: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  neededBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  neededNum: { fontSize: 14, fontWeight: "800" },
  wardrobeMatches: { gap: 7 },
  toBuyList: { gap: 7 },
  matchesLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.8 },
  itemRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    padding: 10, borderRadius: 10,
  },
  itemSwatch: { width: 14, height: 14, borderRadius: 3, flexShrink: 0 },
  itemName: { flex: 1, fontSize: 13, fontWeight: "500" },
  checkBadge: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
});
