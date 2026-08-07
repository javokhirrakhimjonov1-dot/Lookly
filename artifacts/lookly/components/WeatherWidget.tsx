import { Feather } from "@/components/FeatherIcon";
import React, { useEffect, useRef } from "react";
import { ActivityIndicator, Animated, Easing, Platform, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useColors } from "@/hooks/useColors";
import { useWeather } from "@/contexts/WeatherContext";
import { useLanguage } from "@/contexts/LanguageContext";

type WeatherScene = "sun" | "heat" | "cloud" | "rain" | "snow" | "wind";
const USE_NATIVE_DRIVER = Platform.OS !== "web";

const stars = [
  { left: "7%", top: 19, size: 3, sparkle: true },
  { left: "18%", top: 74, size: 2, sparkle: false },
  { left: "28%", top: 26, size: 2, sparkle: false },
  { left: "38%", top: 91, size: 3, sparkle: true },
  { left: "49%", top: 32, size: 2, sparkle: false },
  { left: "58%", top: 67, size: 2, sparkle: false },
  { left: "68%", top: 18, size: 3, sparkle: true },
  { left: "76%", top: 84, size: 2, sparkle: false },
  { left: "86%", top: 29, size: 2, sparkle: false },
] as const;

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
  isNight,
}: {
  code: number;
  temperature: number;
  windSpeed: number;
  isNight: boolean;
}) {
  const scene = getWeatherScene(code, temperature, windSpeed);
  const pulse = useRef(new Animated.Value(0)).current;
  const drift = useRef(new Animated.Value(0)).current;
  const fall = useRef(new Animated.Value(0)).current;
  const orbit = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animations = [
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: USE_NATIVE_DRIVER }),
          Animated.timing(pulse, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: USE_NATIVE_DRIVER }),
        ]),
      ),
      Animated.loop(
        Animated.timing(drift, { toValue: 1, duration: scene === "wind" ? 2600 : 9000, easing: Easing.linear, useNativeDriver: USE_NATIVE_DRIVER }),
      ),
      Animated.loop(
        Animated.timing(fall, { toValue: 1, duration: scene === "snow" ? 6200 : 1900, easing: Easing.linear, useNativeDriver: USE_NATIVE_DRIVER }),
      ),
      Animated.loop(
        Animated.timing(orbit, { toValue: 1, duration: 18000, easing: Easing.linear, useNativeDriver: USE_NATIVE_DRIVER }),
      ),
    ];

    animations.forEach((animation) => animation.start());
    return () => animations.forEach((animation) => animation.stop());
  }, [drift, fall, orbit, pulse, scene]);

  const driftX = drift.interpolate({ inputRange: [0, 1], outputRange: [-18, 28] });
  const fallY = fall.interpolate({ inputRange: [0, 1], outputRange: [-18, 160] });
  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.12] });
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.34, 0.62] });
  const rainImpactScale = fall.interpolate({ inputRange: [0, 0.72, 0.93, 1], outputRange: [0.55, 0.55, 1.22, 1.38] });
  const rainImpactOpacity = fall.interpolate({ inputRange: [0, 0.72, 0.93, 1], outputRange: [0, 0, 0.64, 0] });
  const orbitRotation = orbit.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <View pointerEvents="none" style={styles.atmosphere}>
      {isNight && (
        <>
          {stars.map((star, index) => (
            <Animated.View
              key={`star-${index}`}
              style={[
                styles.star,
                { left: star.left, top: star.top, width: star.size, height: star.size, opacity: index % 2 === 0 ? glowOpacity : 0.7 },
              ]}
            >
              {star.sparkle && <><View style={styles.starVertical} /><View style={styles.starHorizontal} /></>}
            </Animated.View>
          ))}
          <Animated.View style={[styles.moonGlow, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]} />
          <Animated.View style={[styles.moonWrap, { transform: [{ translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [-2, 3] }) }] }]}>
            <Feather name="moon" size={54} color="#FFF2B8" />
          </Animated.View>
        </>
      )}
      {(scene === "sun" || scene === "heat") && !isNight && (
        <>
          <Animated.View style={[styles.sunGlow, scene === "heat" && styles.heatGlow, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]} />
          <Animated.View style={[styles.sunRays, { opacity: glowOpacity, transform: [{ rotate: orbitRotation }, { scale: glowScale }] }]}>
            {Array.from({ length: 8 }, (_, index) => <View key={index} style={[styles.sunRay, { transform: [{ rotate: `${index * 45}deg` }] }]} />)}
          </Animated.View>
          <View style={styles.sunCore} />
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
        <>
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
        {scene === "rain" && <><Animated.View style={[styles.rainImpact, styles.rainImpactOne, { opacity: rainImpactOpacity, transform: [{ scaleX: rainImpactScale }] }]} /><Animated.View style={[styles.rainImpact, styles.rainImpactTwo, { opacity: rainImpactOpacity, transform: [{ scaleX: rainImpactScale }] }]} /><Animated.View style={[styles.rainImpact, styles.rainImpactThree, { opacity: rainImpactOpacity, transform: [{ scaleX: rainImpactScale }] }]} /></>}
        </>
      )}
    </View>
  );
}

export default function WeatherWidget() {
  const colors = useColors();
  const weather = useWeather();
  const { t } = useLanguage();

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
  const isNight = new Date().getHours() >= 19 || new Date().getHours() < 6;
  const skyColors: readonly [string, string, ...string[]] = isNight
    ? ["#07162D", "#10294A", "#1E3A56"]
    : scene === "rain" || scene === "wind"
      ? ["#344C63", "#587287", "#8194A0"]
      : scene === "cloud"
        ? ["#3F6E91", "#7FA7BF", "#C4D5DC"]
        : ["#247BC2", "#62B8E7", "#F4C98C"];

  return (
    <View style={[styles.container, { backgroundColor: colors.primary }]}>
      <LinearGradient colors={skyColors} locations={[0, 0.64, 1]} style={StyleSheet.absoluteFillObject} />
      <View style={[styles.horizonHaze, isNight && styles.horizonHazeNight]} />
      <WeatherAtmosphere code={weather.weatherCode} temperature={weather.temperature} windSpeed={weather.windSpeed} isNight={isNight} />
      <View style={styles.left}>
        <Text style={[styles.city, { color: colors.primaryForeground, opacity: 0.7 }]}>
          {weather.city}
        </Text>
        <Text style={[styles.temp, { color: colors.primaryForeground }]}>
          {weather.temperature}°
        </Text>
        <Text style={[styles.condition, { color: colors.primaryForeground, opacity: 0.85 }]}>
          {t(`weather_${weather.conditionDetail.toLowerCase().replaceAll(" ", "_")}`)}
        </Text>
      </View>
      <View style={styles.right}>
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
  horizonHaze: { position: "absolute", left: -40, right: -40, bottom: -52, height: 104, borderRadius: 999, backgroundColor: "rgba(255, 223, 169, 0.3)" },
  horizonHazeNight: { backgroundColor: "rgba(86, 131, 164, 0.16)" },
  moonGlow: { position: "absolute", width: 112, height: 112, borderRadius: 999, right: 25, top: -20, backgroundColor: "rgba(202, 226, 255, 0.2)" },
  moonWrap: { position: "absolute", width: 55, height: 55, right: 50, top: 8 },
  star: { position: "absolute", borderRadius: 999, backgroundColor: "#FFFFFF", shadowColor: "#D9EDFF", shadowOpacity: 1, shadowRadius: 5 },
  starVertical: { position: "absolute", width: 1, height: 9, left: 1, top: -3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.82)" },
  starHorizontal: { position: "absolute", width: 9, height: 1, left: -3, top: 1, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.82)" },
  atmosphere: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  sunGlow: {
    position: "absolute",
    width: 118,
    height: 118,
    right: 18,
    top: -21,
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
  sunRays: { position: "absolute", width: 78, height: 78, right: 38, top: 0 },
  sunRay: { position: "absolute", width: 3, height: 14, left: 38, top: -3, borderRadius: 999, backgroundColor: "rgba(255, 244, 192, 0.95)", transformOrigin: "1.5px 42px" },
  sunCore: { position: "absolute", width: 48, height: 48, right: 53, top: 15, borderRadius: 999, backgroundColor: "#FFE77A", borderWidth: 2, borderColor: "rgba(255,250,211,0.88)", shadowColor: "#FFD65C", shadowOpacity: 0.95, shadowRadius: 14 },
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
  rainImpact: { position: "absolute", width: 42, height: 8, bottom: 13, borderWidth: 1, borderColor: "rgba(211, 237, 255, 0.85)", borderRadius: 999 },
  rainImpactOne: { left: "15%" },
  rainImpactTwo: { left: "50%", bottom: 31 },
  rainImpactThree: { right: "11%", bottom: 21 },
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
