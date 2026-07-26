import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getBottomPadding, getTopPadding } from "@/constants/layout";
import CategoryPill from "@/components/CategoryPill";
import ClothingItemCard from "@/components/ClothingItemCard";
import ItemDetailSheet from "@/components/ItemDetailSheet";
import { useColors } from "@/hooks/useColors";
import {
  type ClothingCategory,
  type ClothingItem,
  useWardrobe,
} from "@/contexts/WardrobeContext";
import { useLanguage } from "@/contexts/LanguageContext";

export default function WardrobeScreen() {
  const colors = useColors();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const gridGap = 10;
  const gridPadding = 28;
  const preferredCardWidth = 260;
  const numCols = screenW > 600
    ? Math.max(3, Math.floor((screenW - gridPadding + gridGap) / (preferredCardWidth + gridGap)))
    : 2;
  const cardWidth = (screenW - gridPadding - gridGap * (numCols - 1)) / numCols;
  const { items, removeItem, isLoading } = useWardrobe();
  const [activeCategory, setActiveCategory] = useState<"all" | ClothingCategory>("all");
  const [selectedItem, setSelectedItem] = useState<ClothingItem | null>(null);

  const CATEGORIES: { key: "all" | ClothingCategory; label: string }[] = [
    { key: "all", label: t("cat_all") },
    { key: "tops", label: t("cat_tops") },
    { key: "bottoms", label: t("cat_bottoms") },
    { key: "dresses", label: t("cat_dresses") },
    { key: "outerwear", label: t("cat_outerwear") },
    { key: "shoes", label: t("cat_shoes") },
    { key: "socks", label: t("cat_socks") },
    { key: "accessories", label: t("cat_accessories") },
  ];

  const topPad = getTopPadding(insets.top);
  const bottomPad = getBottomPadding(insets.bottom, 100);

  const filtered =
    activeCategory === "all"
      ? items
      : items.filter((i) => i.category === activeCategory);

  const handleDelete = (id: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    removeItem(id);
  };

  const handleItemPress = (item: ClothingItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedItem(item);
  };

  const handleAdd = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/add-item");
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* ── Header ── */}
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
          <View style={styles.headerTitleGroup}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Exit wardrobe"
              onPress={() => router.replace("/")}
              style={[styles.exitBtn, { backgroundColor: colors.secondary }]}
            >
              <Feather name="arrow-left" size={20} color={colors.foreground} />
            </TouchableOpacity>
            <View>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>{t("my_wardrobe")}</Text>
              <Text style={[styles.title, { color: colors.foreground }]}>
                {items.length} {t(items.length === 1 ? "item_singular" : "item_plural")}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/outfit-builder")}
            style={[styles.buildBtn, { backgroundColor: colors.secondary }]}
          >
            <Feather name="scissors" size={15} color={colors.accent} />
            <Text style={[styles.buildBtnText, { color: colors.accent }]}>{t("build_look")}</Text>
          </TouchableOpacity>
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

      {/* ── Grid ── */}
      {!isLoading && filtered.length === 0 ? (
        <View style={[styles.empty, { paddingBottom: bottomPad }]}>
          <Feather name="layers" size={40} color={colors.border} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            {activeCategory === "all"
              ? t("wardrobe_empty")
              : `${t(`cat_${activeCategory}`)} — ${t("wardrobe_empty").toLowerCase()}`}
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
            {t("tap_add_first")}
          </Text>
        </View>
      ) : (
        <FlatList
          key={numCols}
          data={filtered}
          keyExtractor={(item) => item.id}
          numColumns={numCols}
          contentContainerStyle={[styles.gridContent, { paddingBottom: bottomPad }]}
          columnWrapperStyle={styles.row}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={{ width: cardWidth }}>
              <ClothingItemCard
                item={item}
                onPress={() => handleItemPress(item)}
                onDelete={() => handleDelete(item.id)}
              />
            </View>
          )}
        />
      )}

      {/* ── Floating Action Button ── */}
      <TouchableOpacity
        onPress={handleAdd}
        style={[
          styles.fab,
          {
            backgroundColor: colors.accent,
            // Keep the full button above the fixed bottom navigation on web and mobile.
            bottom: getBottomPadding(insets.bottom, 68),
          },
        ]}
        activeOpacity={0.85}
      >
        <Feather name="plus" size={26} color={colors.card} />
      </TouchableOpacity>

      <ItemDetailSheet
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onDelete={(id) => {
          handleDelete(id);
          setSelectedItem(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
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
  headerTitleGroup: { flexDirection: "row", alignItems: "center", gap: 10 },
  exitBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
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
  buildBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
  },
  buildBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
  pills: {
    paddingRight: 18,
  },
  gridContent: {
    paddingHorizontal: 14,
    paddingTop: 16,
  },
  row: {
    gap: 10,
    marginBottom: 10,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 8,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: "center",
  },
  fab: {
    position: "absolute",
    right: 22,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 99,
    shadowColor: "#C8906A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
});
