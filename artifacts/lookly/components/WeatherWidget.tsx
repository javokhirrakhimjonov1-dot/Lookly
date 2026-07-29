import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { ActivityIndicator, Animated, Easing, Image, ImageSourcePropType, StyleSheet, Text, View } from "react-native";
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

type WeatherScene = "sun" | "heat" | "cloud" | "rain" | "snow" | "wind";

const weatherScenes: Record<"sunny" | "moody", ImageSourcePropType> = {
  sunny: require("@/assets/images/weather-sun-city.png"),
  moody: require("@/assets/images/weather-cloud-city.png"),
};

function getWeatherScene(code: number, temperature: number, windSpeed: number): WeatherScene {
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return "snow";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95) return "rain";
  if (windSpeed >= 25 || (code >= 45 && code <= 48)) return "wind";
  if (code >= 1 && code <= 3) return "cloud";
  if (temperature >= 32) return "heat";
  return "sun";
}

function WeatherAtmosphere({
  code,
  temperature,
  windSpeed,
}: {
  code: number;
  temperature: number;
  windSpeed: number;
}) {
  const scene = getWeatherScene(code, temperature, windSpeed);
  const pulse = useRef(new Animated.Value(0)).current;
  const drift = useRef(new Animated.Value(0)).current;
  const fall = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animations = [
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      ),
      Animated.loop(
        Animated.timing(drift, { toValue: 1, duration: scene === "wind" ? 2600 : 9000, easing: Easing.linear, useNativeDriver: true }),
      ),
      Animated.loop(
        Animated.timing(fall, { toValue: 1, duration: scene === "snow" ? 6200 : 1900, easing: Easing.linear, useNativeDriver: true }),
      ),
    ];

    animations.forEach((animation) => animation.start());
    return () => animations.forEach((animation) => animation.stop());
  }, [drift, fall, pulse, scene]);

  const driftX = drift.interpolate({ inputRange: [0, 1], outputRange: [-18, 28] });
  const fallY = fall.interpolate({ inputRange: [0, 1], outputRange: [-18, 160] });
  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.12] });
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.34, 0.62] });

  return (
    <View pointerEvents="none" style={styles.atmosphere}>
      {(scene === "sun" || scene === "heat") && (
        <>
          <Animated.View style={[styles.sunGlow, scene === "heat" && styles.heatGlow, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]} />
          <Animated.View style={[styles.sunRing, { transform: [{ scale: glowScale }] }]} />
        </>
      )}

      {scene === "cloud" && (
        <Animated.View style={[styles.cloudGroup, { transform: [{ translateX: driftX }] }]}>
          <View style={styles.cloudLarge} />
          <View style={styles.cloudSmall} />
          <View style={styles.cloudLow} />
        </Animated.View>
      )}

      {scene === "wind" && (
        <Animated.View style={[styles.windGroup, { transform: [{ translateX: driftX }] }]}>
          <View style={[styles.windLine, styles.windLineOne]} />
          <View style={[styles.windLine, styles.windLineTwo]} />
          <View style={[styles.windLine, styles.windLineThree]} />
        </Animated.View>
      )}

      {(scene === "rain" || scene === "snow") && (
        <Animated.View style={[styles.precipitation, { transform: [{ translateY: fallY }] }]}>
          {Array.from({ length: 13 }, (_, index) => (
            <View
              key={index}
              style={[
                scene === "rain" ? styles.raindrop : styles.snowflake,
                {
                  left: `${6 + ((index * 19) % 88)}%`,
                  top: 4 + ((index * 29) % 125),
                  opacity: 0.2 + (index % 4) * 0.1,
                },
              ]}
            />
          ))}
        </Animated.View>
      )}
    </View>
  );
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

  const scene = getWeatherScene(weather.weatherCode, weather.temperature, weather.windSpeed);
  const sceneImage = scene === "sun" || scene === "heat" ? weatherScenes.sunny : weatherScenes.moody;

  return (
    <View style={[styles.container, { backgroundColor: colors.primary }]}>
      <Image source={sceneImage} resizeMode="cover" style={styles.sceneImage} />
      <View style={styles.sceneShade} />
      <WeatherAtmosphere code={weather.weatherCode} temperature={weather.temperature} windSpeed={weather.windSpeed} />
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
    overflow: "hidden",
    position: "relative",
  },
  sceneImage: {
    ...StyleSheet.absoluteFillObject,
    width: undefined,
    height: undefined,
  },
  sceneShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10, 18, 27, 0.34)",
  },
  atmosphere: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  sunGlow: {
    position: "absolute",
    width: 210,
    height: 210,
    right: -38,
    top: -86,
    borderRadius: 999,
    backgroundColor: "rgba(255, 208, 118, 0.25)",
  },
  heatGlow: {
    width: 260,
    height: 260,
    right: -72,
    top: -112,
    backgroundColor: "rgba(248, 142, 77, 0.22)",
  },
  sunRing: {
    position: "absolute",
    width: 126,
    height: 126,
    right: 7,
    top: -43,
    borderWidth: 1,
    borderColor: "rgba(255, 240, 196, 0.22)",
    borderRadius: 999,
  },
  cloudGroup: {
    position: "absolute",
    right: -34,
    top: -30,
    width: 220,
    height: 140,
  },
  cloudLarge: {
    position: "absolute",
    width: 180,
    height: 104,
    right: 0,
    top: 12,
    borderRadius: 80,
    backgroundColor: "rgba(231, 237, 246, 0.12)",
  },
  cloudSmall: {
    position: "absolute",
    width: 105,
    height: 88,
    right: 92,
    top: 0,
    borderRadius: 70,
    backgroundColor: "rgba(231, 237, 246, 0.14)",
  },
  cloudLow: {
    position: "absolute",
    width: 142,
    height: 64,
    right: 18,
    top: 72,
    borderRadius: 60,
    backgroundColor: "rgba(231, 237, 246, 0.08)",
  },
  windGroup: {
    position: "absolute",
    right: 10,
    top: 17,
    width: 210,
    height: 105,
  },
  windLine: {
    position: "absolute",
    height: 2,
    borderRadius: 4,
    backgroundColor: "rgba(239, 247, 255, 0.32)",
  },
  windLineOne: {
    width: 118,
    right: 0,
    top: 10,
  },
  windLineTwo: {
    width: 72,
    right: 38,
    top: 36,
  },
  windLineThree: {
    width: 146,
    right: 18,
    top: 62,
  },
  precipitation: {
    ...StyleSheet.absoluteFillObject,
  },
  raindrop: {
    position: "absolute",
    width: 2,
    height: 18,
    borderRadius: 4,
    backgroundColor: "rgba(202, 229, 255, 0.75)",
    transform: [{ rotate: "18deg" }],
  },
  snowflake: {
    position: "absolute",
    width: 5,
    height: 5,
    borderRadius: 999,
    backgroundColor: "rgba(247, 251, 255, 0.9)",
  },
  left: {
    flex: 1,
    gap: 2,
    zIndex: 1,
    textShadowColor: "rgba(0,0,0,0.32)",
  },
  right: {
    alignItems: "flex-end",
    gap: 8,
    zIndex: 1,
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
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
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
