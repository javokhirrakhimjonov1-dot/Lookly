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
import OutfitSuggestion from "@/components/OutfitSuggestion";
import WeatherWidget from "@/components/WeatherWidget";
import { useColors } from "@/hooks/useColors";
import { useSocial } from "@/contexts/SocialContext";
import { useWardrobe } from "@/contexts/WardrobeContext";
import { useDeals } from "@/contexts/DealsContext";

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { items } = useWardrobe();
  const { looks } = useSocial();
  const { deals } = useDeals();

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

      <WeatherWidget />

      <OutfitSuggestion />

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
        <View style={[styles.alertCard, { backgroundColor: "#FEF2F2", borderColor: "#FECACA" }]}>
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
  alertCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  alertTitle: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 2,
  },
  alertBody: {
    fontSize: 12,
    fontWeight: "400",
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
