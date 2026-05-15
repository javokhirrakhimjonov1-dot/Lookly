import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import CategoryPill from "@/components/CategoryPill";
import DealCard from "@/components/DealCard";
import { useColors } from "@/hooks/useColors";
import { useDeals } from "@/contexts/DealsContext";

const CATEGORIES = ["All", "Women", "Men", "Kids"];

export default function DealsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { filteredDeals, activeCategory, setActiveCategory, deals } = useDeals();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const newCount = deals.filter((d) => d.isNew).length;

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
            <Text style={[styles.label, { color: colors.mutedForeground }]}>TASHKENT</Text>
            <Text style={[styles.title, { color: colors.foreground }]}>Local Deals</Text>
          </View>
          <View style={[styles.newBadge, { backgroundColor: "#DC2626" }]}>
            <Text style={styles.newBadgeText}>{newCount} new</Text>
          </View>
        </View>
        <View style={[styles.infoCard, { backgroundColor: colors.secondary }]}>
          <Feather name="bell" size={14} color={colors.accent} />
          <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
            Showing live discounts from Tashkent brands
          </Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pills}
        >
          {CATEGORIES.map((c) => (
            <CategoryPill
              key={c}
              label={c}
              isActive={activeCategory === c}
              onPress={() => setActiveCategory(c)}
            />
          ))}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Platform.OS === "web" ? 100 : insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.resultCount, { color: colors.mutedForeground }]}>
          {filteredDeals.length} {filteredDeals.length === 1 ? "deal" : "deals"} found
        </Text>
        {filteredDeals.map((deal) => (
          <DealCard key={deal.id} deal={deal} />
        ))}
        {filteredDeals.length === 0 && (
          <View style={styles.empty}>
            <Feather name="tag" size={40} color={colors.border} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              No deals in this category
            </Text>
          </View>
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
    paddingHorizontal: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
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
  newBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 100,
  },
  newBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  infoText: {
    fontSize: 12,
    fontWeight: "500",
  },
  pills: {
    paddingRight: 18,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 14,
  },
  resultCount: {
    fontSize: 12,
    fontWeight: "500",
    marginBottom: 8,
  },
  empty: {
    alignItems: "center",
    paddingVertical: 60,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 8,
  },
});
