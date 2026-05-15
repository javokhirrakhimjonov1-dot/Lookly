import { Feather } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { useWeather } from "@/contexts/WeatherContext";

function WeatherIcon({ code, color, size = 28 }: { code: number; color: string; size?: number }) {
  let name: React.ComponentProps<typeof Feather>["name"] = "sun";
  if (code === 0) name = "sun";
  else if (code <= 3) name = "cloud";
  else if (code <= 48) name = "wind";
  else if (code <= 67) name = "cloud-rain";
  else if (code <= 77) name = "cloud-snow";
  else if (code <= 82) name = "cloud-drizzle";
  else name = "zap";
  return <Feather name={name} size={size} color={color} />;
}

export default function WeatherWidget() {
  const colors = useColors();
  const weather = useWeather();

  if (weather.isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.primary }]}>
        <ActivityIndicator color={colors.primaryForeground} />
      </View>
    );
  }

  const getOutfitTip = (temp: number, code: number): string => {
    if (code >= 51 && code <= 82) return "Bring a raincoat today";
    if (code >= 83) return "Stay home — storm warning";
    if (temp >= 35) return "Ultra-light fabrics only";
    if (temp >= 28) return "Light & breathable fits";
    if (temp >= 20) return "Perfect for a relaxed look";
    if (temp >= 12) return "Layer up — add a jacket";
    if (temp >= 5) return "Time for your coat collection";
    return "Full winter armour today";
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.primary }]}>
      <View style={styles.left}>
        <Text style={[styles.city, { color: colors.primaryForeground, opacity: 0.7 }]}>
          Tashkent
        </Text>
        <Text style={[styles.temp, { color: colors.primaryForeground }]}>
          {weather.temperature}°
        </Text>
        <Text style={[styles.condition, { color: colors.primaryForeground, opacity: 0.85 }]}>
          {weather.conditionDetail}
        </Text>
      </View>
      <View style={styles.right}>
        <WeatherIcon code={weather.weatherCode} color={colors.primaryForeground} size={42} />
        <View style={[styles.tipBox, { backgroundColor: "rgba(255,255,255,0.12)" }]}>
          <Text style={[styles.tipText, { color: colors.primaryForeground }]}>
            {getOutfitTip(weather.temperature, weather.weatherCode)}
          </Text>
        </View>
        <View style={styles.statRow}>
          <View style={styles.stat}>
            <Feather name="droplet" size={11} color={colors.primaryForeground} style={{ opacity: 0.7 }} />
            <Text style={[styles.statText, { color: colors.primaryForeground }]}>{weather.humidity}%</Text>
          </View>
          <View style={styles.stat}>
            <Feather name="wind" size={11} color={colors.primaryForeground} style={{ opacity: 0.7 }} />
            <Text style={[styles.statText, { color: colors.primaryForeground }]}>{weather.windSpeed} km/h</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    padding: 22,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    minHeight: 140,
  },
  left: {
    flex: 1,
    gap: 2,
  },
  right: {
    alignItems: "flex-end",
    gap: 8,
  },
  city: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  temp: {
    fontSize: 56,
    fontWeight: "700",
    lineHeight: 60,
  },
  condition: {
    fontSize: 14,
    fontWeight: "500",
  },
  tipBox: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: 160,
  },
  tipText: {
    fontSize: 12,
    fontWeight: "500",
    textAlign: "right",
  },
  statRow: {
    flexDirection: "row",
    gap: 10,
  },
  stat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  statText: {
    fontSize: 11,
    fontWeight: "500",
    opacity: 0.8,
  },
});
