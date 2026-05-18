import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import OutfitCarousel from "@/components/OutfitCarousel";
import WeatherWidget from "@/components/WeatherWidget";
import { useColors } from "@/hooks/useColors";
import { useSocial } from "@/contexts/SocialContext";
import { useWardrobe } from "@/contexts/WardrobeContext";
import { useDeals } from "@/contexts/DealsContext";
import { useWeather } from "@/contexts/WeatherContext";

const ALERT_BG: Record<string, string> = {
  temperature_drop: "#EFF6FF",
  temperature_rise: "#FEF9EC",
  rain_incoming: "#EFF6FF",
  snow_incoming: "#F0FDF4",
};
const ALERT_BORDER: Record<string, string> = {
  temperature_drop: "#BFDBFE",
  temperature_rise: "#FDE68A",
  rain_incoming: "#93C5FD",
  snow_incoming: "#BBF7D0",
};
const ALERT_COLOR: Record<string, string> = {
  temperature_drop: "#1D4ED8",
  temperature_rise: "#D97706",
  rain_incoming: "#1D4ED8",
  snow_incoming: "#059669",
};
const ALERT_ICON: Record<string, React.ComponentProps<typeof Feather>["name"]> = {
  temperature_drop: "thermometer",
  temperature_rise: "sun",
  rain_incoming: "cloud-rain",
  snow_incoming: "cloud-snow",
};

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { items } = useWardrobe();
  const { looks } = useSocial();
  const { deals } = useDeals();
  const { weatherAlert, dismissAlert, condition, temperature } = useWeather();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const urgentDeals = deals.filter(
    (d) =>
      Math.ceil((new Date(d.expiresAt).getTime() - Date.now()) / 86400000) <= 2
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: topPad + 16,
          paddingBottom: Platform.OS === "web" ? 100 : insets.bottom + 100,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.greeting, { color: colors.mutedForeground }]}>
            {today}
          </Text>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Good morning
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push("/profile")}
          style={[styles.avatarBtn, { backgroundColor: colors.primary }]}
        >
          <Text style={[styles.avatarText, { color: colors.primaryForeground }]}>
            Y
          </Text>
        </TouchableOpacity>
      </View>

      {weatherAlert && (
        <TouchableOpacity
          onPress={dismissAlert}
          style={[
            styles.alertCard,
            {
              backgroundColor: ALERT_BG[weatherAlert.type] ?? "#FEF9EC",
              borderColor: ALERT_BORDER[weatherAlert.type] ?? "#FDE68A",
            },
          ]}
          activeOpacity={0.85}
        >
          <View
            style={[
              styles.alertIconWrap,
              { backgroundColor: (ALERT_COLOR[weatherAlert.type] ?? "#D97706") + "20" },
            ]}
          >
            <Feather
              name={ALERT_ICON[weatherAlert.type] ?? "alert-circle"}
              size={16}
              color={ALERT_COLOR[weatherAlert.type] ?? "#D97706"}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.alertTitle, { color: ALERT_COLOR[weatherAlert.type] ?? "#D97706" }]}>
              {weatherAlert.title}
            </Text>
            <Text style={[styles.alertBody, { color: ALERT_COLOR[weatherAlert.type] ?? "#D97706" }]}>
              {weatherAlert.message}
            </Text>
          </View>
          <Feather name="x" size={14} color={ALERT_COLOR[weatherAlert.type] ?? "#D97706"} />
        </TouchableOpacity>
      )}

      <WeatherWidget />

      <TouchableOpacity
        onPress={() => router.push("/outfit-builder?autoStart=true")}
        style={[styles.weatherLookCard, { backgroundColor: colors.accent }]}
        activeOpacity={0.88}
      >
        <View style={styles.weatherLookLeft}>
          <Text style={styles.weatherLookLabel}>TODAY'S WEATHER</Text>
          <Text style={styles.weatherLookTitle}>Make Your Look</Text>
          <Text style={styles.weatherLookSub}>
            AI picks the perfect outfit for {temperature}°C · {condition}
          </Text>
        </View>
        <View style={styles.weatherLookIconWrap}>
          <Feather name="cloud" size={22} color="rgba(250,248,245,0.7)" />
          <Feather name="arrow-right" size={20} color="#FAF8F5" style={{ marginTop: 6 }} />
        </View>
      </TouchableOpacity>

      <OutfitCarousel />

      <TouchableOpacity
        onPress={() => router.push("/shuffle")}
        style={[styles.shuffleCard, { backgroundColor: colors.primary }]}
      >
        <View style={styles.shuffleLeft}>
          <Text style={[styles.shuffleLabel, { color: "rgba(250,248,245,0.7)" }]}>
            FEELING LUCKY?
          </Text>
          <Text style={[styles.shuffleTitle, { color: colors.primaryForeground }]}>
            Lucky Shuffle
          </Text>
          <Text style={[styles.shuffleSub, { color: "rgba(250,248,245,0.7)" }]}>
            Lock favourites · AI picks the rest
          </Text>
        </View>
        <View style={[styles.shuffleIconWrap, { backgroundColor: "rgba(250,248,245,0.15)" }]}>
          <Feather name="shuffle" size={28} color={colors.primaryForeground} />
        </View>
      </TouchableOpacity>

      <View style={styles.statsRow}>
        <TouchableOpacity
          onPress={() => router.push("/(tabs)/wardrobe")}
          style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Text style={[styles.statNumber, { color: colors.foreground }]}>{items.length}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Wardrobe items</Text>
          <Feather name="layers" size={16} color={colors.accent} style={{ marginTop: 2 }} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push("/(tabs)/looks")}
          style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Text style={[styles.statNumber, { color: colors.foreground }]}>{looks.length}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Daily looks</Text>
          <Feather name="camera" size={16} color={colors.accent} style={{ marginTop: 2 }} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push("/(tabs)/deals")}
          style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Text style={[styles.statNumber, { color: "#DC2626" }]}>{urgentDeals.length}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Deals expiring</Text>
          <Feather name="tag" size={16} color="#DC2626" style={{ marginTop: 2 }} />
        </TouchableOpacity>
      </View>

      {urgentDeals.length > 0 && (
        <View style={[styles.dealsAlert, { backgroundColor: "#FEF2F2", borderColor: "#FECACA" }]}>
          <Feather name="bell" size={16} color="#DC2626" />
          <View style={{ flex: 1 }}>
            <Text style={[styles.alertTitle, { color: "#DC2626" }]}>
              Flash deals ending soon
            </Text>
            <Text style={[styles.alertBody, { color: "#991B1B" }]}>
              {urgentDeals.map((d) => d.brandName).join(", ")} — don't miss out
            </Text>
          </View>
          <TouchableOpacity onPress={() => router.push("/(tabs)/deals")}>
            <Feather name="arrow-right" size={16} color="#DC2626" />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          Friends' Looks
        </Text>
        <TouchableOpacity onPress={() => router.push("/(tabs)/looks")}>
          <Text style={[styles.seeAll, { color: colors.accent }]}>See all</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.recentLooks}
      >
        {looks.slice(0, 4).map((look) => {
          const initials = look.userName
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
          const avatarColors = ["#C8906A", "#8B7355", "#2D5BE3", "#6B21A8"];
          const idx =
            look.userId
              .split("")
              .reduce((a, c) => a + c.charCodeAt(0), 0) % avatarColors.length;
          return (
            <TouchableOpacity
              key={look.id}
              onPress={() => router.push("/(tabs)/looks")}
              style={[styles.lookPreview, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View
                style={[styles.lookImagePlaceholder, { backgroundColor: colors.secondary }]}
              >
                <Feather name="camera" size={20} color={colors.border} />
              </View>
              <View
                style={[
                  styles.lookAvatar,
                  { backgroundColor: avatarColors[idx], borderColor: colors.background },
                ]}
              >
                <Text style={styles.lookAvatarText}>{initials}</Text>
              </View>
              <View style={styles.lookCardBottom}>
                <Text
                  style={[styles.lookUserName, { color: colors.foreground }]}
                  numberOfLines={1}
                >
                  {look.userName.split(" ")[0]}
                </Text>
                <View style={styles.lookLikes}>
                  <Feather
                    name="heart"
                    size={10}
                    color={look.isLiked ? "#E05B5B" : colors.mutedForeground}
                  />
                  <Text style={[styles.lookLikeCount, { color: colors.mutedForeground }]}>
                    {look.likes}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          onPress={() => router.push("/(tabs)/looks")}
          style={[styles.lookPreview, styles.addLookPreview, { backgroundColor: colors.secondary, borderColor: colors.border }]}
        >
          <Feather name="plus" size={24} color={colors.mutedForeground} />
          <Text style={[styles.addLookText, { color: colors.mutedForeground }]}>Post look</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 18,
    gap: 16,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  greeting: {
    fontSize: 12,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
  },
  avatarBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 16,
    fontWeight: "700",
  },
  alertCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  alertIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 1,
  },
  alertTitle: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 2,
  },
  alertBody: {
    fontSize: 12,
    fontWeight: "400",
    lineHeight: 17,
    opacity: 0.85,
  },
  weatherLookCard: {
    borderRadius: 20,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  weatherLookLeft: { gap: 4, flex: 1 },
  weatherLookLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 1.2, color: "rgba(250,248,245,0.7)" },
  weatherLookTitle: { fontSize: 22, fontWeight: "800", color: "#FAF8F5" },
  weatherLookSub: { fontSize: 12, fontWeight: "400", color: "rgba(250,248,245,0.8)", lineHeight: 17 },
  weatherLookIconWrap: { alignItems: "center", justifyContent: "center", paddingLeft: 16 },
  shuffleCard: {
    borderRadius: 20,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  shuffleLeft: { gap: 3 },
  shuffleLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  shuffleTitle: { fontSize: 22, fontWeight: "800" },
  shuffleSub: { fontSize: 12, fontWeight: "400" },
  shuffleIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    alignItems: "flex-start",
    gap: 2,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "800",
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "500",
  },
  dealsAlert: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  seeAll: {
    fontSize: 13,
    fontWeight: "600",
  },
  recentLooks: {
    paddingRight: 18,
    gap: 10,
  },
  lookPreview: {
    width: 130,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  lookImagePlaceholder: {
    height: 140,
    alignItems: "center",
    justifyContent: "center",
  },
  lookAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    position: "absolute",
    top: 120,
    left: 10,
  },
  lookAvatarText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  lookCardBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 10,
    paddingTop: 16,
  },
  lookUserName: {
    fontSize: 12,
    fontWeight: "600",
  },
  lookLikes: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  lookLikeCount: {
    fontSize: 11,
    fontWeight: "500",
  },
  addLookPreview: {
    width: 130,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 182,
  },
  addLookText: {
    fontSize: 12,
    fontWeight: "500",
  },
});
