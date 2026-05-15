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
import { useColors } from "@/hooks/useColors";
import { useWardrobe } from "@/contexts/WardrobeContext";
import { useSocial } from "@/contexts/SocialContext";

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { items } = useWardrobe();
  const { looks } = useSocial();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const myLooks = looks.filter((l) => l.isOwn);

  const rows = [
    {
      icon: "bell" as const,
      label: "Deal notifications",
      description: "Get alerts for new Tashkent discounts",
    },
    {
      icon: "cloud" as const,
      label: "Weather location",
      description: "Tashkent, Uzbekistan",
    },
    {
      icon: "shield" as const,
      label: "Privacy",
      description: "Manage who sees your looks",
    },
    {
      icon: "info" as const,
      label: "About Lookly",
      description: "Version 1.0.0",
    },
  ];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: topPad + 16,
          paddingBottom: Platform.OS === "web" ? 60 : insets.bottom + 40,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Feather name="arrow-left" size={22} color={colors.foreground} />
      </TouchableOpacity>

      <View style={styles.profileCard}>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Text style={[styles.avatarText, { color: colors.primaryForeground }]}>Y</Text>
        </View>
        <Text style={[styles.name, { color: colors.foreground }]}>Your Profile</Text>
        <Text style={[styles.location, { color: colors.mutedForeground }]}>
          Tashkent, Uzbekistan
        </Text>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={[styles.statNumber, { color: colors.foreground }]}>{items.length}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Items</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.stat}>
            <Text style={[styles.statNumber, { color: colors.foreground }]}>{myLooks.length}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>My Looks</Text>
          </View>
        </View>
      </View>

      <View style={[styles.settingsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {rows.map((row, i) => (
          <TouchableOpacity
            key={row.label}
            style={[
              styles.settingsRow,
              i < rows.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
            ]}
          >
            <View style={[styles.rowIcon, { backgroundColor: colors.secondary }]}>
              <Feather name={row.icon} size={16} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: colors.foreground }]}>{row.label}</Text>
              <Text style={[styles.rowDesc, { color: colors.mutedForeground }]}>{row.description}</Text>
            </View>
            <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 18,
    gap: 16,
  },
  backBtn: {
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  profileCard: {
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: "700",
  },
  name: {
    fontSize: 22,
    fontWeight: "700",
  },
  location: {
    fontSize: 14,
    fontWeight: "400",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 24,
    marginTop: 8,
  },
  stat: {
    alignItems: "center",
    gap: 2,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "800",
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  divider: {
    width: 1,
    height: 32,
  },
  settingsCard: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
  },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 1,
  },
  rowDesc: {
    fontSize: 12,
    fontWeight: "400",
  },
});
