import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import CategoryPill from "@/components/CategoryPill";
import ClothingItemCard from "@/components/ClothingItemCard";
import { useColors } from "@/hooks/useColors";
import { type ClothingCategory, useWardrobe } from "@/contexts/WardrobeContext";

const CATEGORIES: { key: "all" | ClothingCategory; label: string }[] = [
  { key: "all", label: "All" },
  { key: "tops", label: "Tops" },
  { key: "bottoms", label: "Bottoms" },
  { key: "dresses", label: "Dresses" },
  { key: "outerwear", label: "Outerwear" },
  { key: "shoes", label: "Shoes" },
  { key: "accessories", label: "Accessories" },
];

export default function WardrobeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { items, removeItem, isLoading } = useWardrobe();
  const [activeCategory, setActiveCategory] = useState<"all" | ClothingCategory>("all");

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const filtered =
    activeCategory === "all"
      ? items
      : items.filter((i) => i.category === activeCategory);

  const handleDelete = (id: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    removeItem(id);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: topPad + 16,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.headerTop}>
          <View>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>MY WARDROBE</Text>
            <Text style={[styles.title, { color: colors.foreground }]}>
              {items.length} {items.length === 1 ? "item" : "items"}
            </Text>
          </View>
          <View style={styles.headerBtns}>
            <TouchableOpacity
              onPress={() => router.push("/outfit-builder")}
              style={[styles.buildBtn, { backgroundColor: colors.secondary }]}
            >
              <Feather name="scissors" size={16} color={colors.accent} />
              <Text style={[styles.buildBtnText, { color: colors.accent }]}>Build Look</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push("/add-item")}
              style={[styles.addBtn, { backgroundColor: colors.primary }]}
            >
              <Feather name="plus" size={20} color={colors.primaryForeground} />
            </TouchableOpacity>
          </View>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pills}
        >
          {CATEGORIES.map((c) => (
            <CategoryPill
              key={c.key}
              label={c.label}
              isActive={activeCategory === c.key}
              onPress={() => setActiveCategory(c.key)}
              count={
                c.key === "all"
                  ? undefined
                  : items.filter((i) => i.category === c.key).length
              }
            />
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom: Platform.OS === "web" ? 100 : insets.bottom + 100,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? null : filtered.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="layers" size={40} color={colors.border} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              {activeCategory === "all" ? "Your wardrobe is empty" : `No ${activeCategory} yet`}
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
              Tap the + button to add your first item
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/add-item")}
              style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.emptyBtnText, { color: colors.primaryForeground }]}>
                Add item
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          filtered.map((item) => (
            <ClothingItemCard
              key={item.id}
              item={item}
              onDelete={() => handleDelete(item.id)}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    borderBottomWidth: 1,
    paddingHorizontal: 18,
    paddingBottom: 12,
    gap: 12,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  label: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
  },
  headerBtns: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  buildBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 22,
  },
  buildBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  pills: {
    paddingRight: 18,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 16,
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    fontWeight: "400",
    textAlign: "center",
  },
  emptyBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 100,
    marginTop: 8,
  },
  emptyBtnText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
