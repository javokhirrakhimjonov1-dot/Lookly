import { Feather } from "@expo/vector-icons";
import React, { useMemo } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getBottomPadding } from "@/constants/layout";
import { getTopPadding } from "@/constants/layout";
import { useColors } from "@/hooks/useColors";
import { type ClothingCategory, type ClothingItem, type Currency, useWardrobe } from "@/contexts/WardrobeContext";
import { useLanguage } from "@/contexts/LanguageContext";

const CATEGORY_COLORS: Record<ClothingCategory, string> = {
  tops: "#C8906A",
  bottoms: "#1E3A5F",
  dresses: "#800020",
  outerwear: "#6B7C4D",
  shoes: "#C19A6B",
  accessories: "#8A8A8A",
};

const ALL_CATEGORIES: ClothingCategory[] = [
  "tops", "bottoms", "dresses", "outerwear", "shoes", "accessories",
];

function isLight(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}

function formatMoney(value: number, currency: Currency = "USD"): string {
  const amount = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
  if (currency === "UZS") return `${amount} soʻm`;
  if (currency === "RUB") return `₽${amount}`;
  return `$${amount}`;
}

function CostPerWearCard({ item }: { item: ClothingItem }) {
  const colors = useColors();
  const { t } = useLanguage();
  const cpw =
    item.purchasePrice && item.timesWorn > 0
      ? (item.purchasePrice / item.timesWorn).toFixed(2)
      : null;
  const currency = item.purchaseCurrency ?? "USD";

  return (
    <View
      style={[
        styles.cpwCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={[styles.cpwColor, { backgroundColor: item.colorHex }]} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.cpwName, { color: colors.foreground }]} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={[styles.cpwMeta, { color: colors.mutedForeground }]}>
          {item.timesWorn}× {t("stat_worn")}
          {item.purchasePrice ? ` · ${formatMoney(item.purchasePrice, currency)}` : ""}
        </Text>
      </View>
      {cpw ? (
        <View style={[styles.cpwBadge, { backgroundColor: colors.secondary }]}>
          <Text style={[styles.cpwValue, { color: colors.accent }]}>{formatMoney(Number(cpw), currency)}</Text>
          <Text style={[styles.cpwLabel, { color: colors.mutedForeground }]}>{t("stat_per_wear")}</Text>
        </View>
      ) : item.timesWorn > 0 ? (
        <View style={[styles.cpwBadge, { backgroundColor: colors.secondary }]}>
          <Text style={[styles.cpwValue, { color: colors.foreground }]}>
            {item.timesWorn}×
          </Text>
          <Text style={[styles.cpwLabel, { color: colors.mutedForeground }]}>{t("stat_worn")}</Text>
        </View>
      ) : (
        <View style={[styles.cpwBadge, { backgroundColor: colors.destructive + "15" }]}>
          <Text style={[styles.cpwValue, { color: colors.destructive }]}>0×</Text>
          <Text style={[styles.cpwLabel, { color: colors.destructive }]}>{t("stat_unworn_badge")}</Text>
        </View>
      )}
    </View>
  );
}

export default function StatsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { items } = useWardrobe();
  const { t } = useLanguage();

  const topPad = getTopPadding(insets.top);

  const stats = useMemo(() => {
    const total = items.length;
    const totalByCurrency: Record<Currency, number> = { USD: 0, UZS: 0, RUB: 0 };
    items.forEach((item) => {
      if (item.purchasePrice) totalByCurrency[item.purchaseCurrency ?? "USD"] += item.purchasePrice;
    });
    const totalWears = items.reduce((s, i) => s + (i.timesWorn ?? 0), 0);
    const unworn = items.filter((i) => (i.timesWorn ?? 0) === 0).length;
    const workwearCount = items.filter((i) => i.isWorkwear).length;

    const byCategory = ALL_CATEGORIES.map((cat) => ({
      cat,
      count: items.filter((i) => i.category === cat).length,
    })).filter((c) => c.count > 0);

    const mostWorn = [...items]
      .filter((i) => (i.timesWorn ?? 0) > 0)
      .sort((a, b) => (b.timesWorn ?? 0) - (a.timesWorn ?? 0))
      .slice(0, 5);

    const bestValue = [...items]
      .filter((i) => i.purchasePrice && (i.timesWorn ?? 0) > 0)
      .sort(
        (a, b) =>
          a.purchasePrice! / a.timesWorn - b.purchasePrice! / b.timesWorn
      )
      .slice(0, 3);

    const leastWorn = [...items]
      .sort((a, b) => (a.timesWorn ?? 0) - (b.timesWorn ?? 0))
      .slice(0, 4);

    const maxCat = Math.max(...byCategory.map((c) => c.count), 1);

    const totalValue = (Object.keys(totalByCurrency) as Currency[])
      .filter((currency) => totalByCurrency[currency] > 0)
      .map((currency) => formatMoney(totalByCurrency[currency], currency))
      .join(" · ");
    return { total, totalValue, totalWears, unworn, workwearCount, byCategory, mostWorn, bestValue, leastWorn, maxCat };
  }, [items]);

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
        <Text style={[styles.label, { color: colors.mutedForeground }]}>{t("tab_wardrobe").toUpperCase()}</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>{t("stats_title")}</Text>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: getBottomPadding(insets.bottom, 100) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {items.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Feather name="bar-chart-2" size={36} color={colors.border} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{t("stat_no_data")}</Text>
            <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
              {t("stat_no_data_body")}
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.summaryGrid}>
              {[
                { label: t("stat_total_items"), value: stats.total, icon: "layers" as const, color: colors.accent },
                { label: t("stat_total_value"), value: stats.totalValue || "—", icon: "dollar-sign" as const, color: colors.accent },
                { label: t("stat_total_wears"), value: stats.totalWears, icon: "trending-up" as const, color: colors.accent },
                { label: t("stat_unworn"), value: stats.unworn, icon: "alert-circle" as const, color: stats.unworn > 0 ? colors.destructive : colors.mutedForeground },
              ].map((s) => (
                <View
                  key={s.label}
                  style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <Feather name={s.icon} size={18} color={s.color} />
                  <Text style={[styles.summaryValue, { color: colors.foreground }]}>
                    {s.value}
                  </Text>
                  <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>
                    {s.label}
                  </Text>
                </View>
              ))}
            </View>

            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                {t("stat_composition")}
              </Text>
              <View style={styles.barChart}>
                {stats.byCategory.map(({ cat, count }) => (
                  <View key={cat} style={styles.barRow}>
                    <Text style={[styles.barLabel, { color: colors.mutedForeground }]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.75}>
                      {t(`cat_${cat}` as Parameters<typeof t>[0])}
                    </Text>
                    <View style={[styles.barTrack, { backgroundColor: colors.secondary }]}>
                      <View
                        style={[
                          styles.barFill,
                          {
                            width: `${(count / stats.maxCat) * 100}%`,
                            backgroundColor: CATEGORY_COLORS[cat],
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.barCount, { color: colors.foreground }]}>{count}</Text>
                  </View>
                ))}
              </View>
              {stats.workwearCount > 0 && (
                <View style={[styles.workwearRow, { borderTopColor: colors.border }]}>
                  <Feather name="briefcase" size={13} color={colors.accent} />
                  <Text style={[styles.workwearText, { color: colors.mutedForeground }]}>
                    {stats.workwearCount} {t(stats.workwearCount === 1 ? "stat_workwear_excl" : "stat_workwear_excl_pl")}
                  </Text>
                </View>
              )}
            </View>

            {stats.mostWorn.length > 0 && (
              <View style={styles.listSection}>
                <Text style={[styles.listTitle, { color: colors.foreground }]}>
                  {t("stat_most_worn")}
                </Text>
                {stats.mostWorn.map((item) => (
                  <CostPerWearCard key={item.id} item={item} />
                ))}
              </View>
            )}

            {stats.bestValue.length > 0 && (
              <View style={styles.listSection}>
                <Text style={[styles.listTitle, { color: colors.foreground }]}>
                  {t("stat_best_value")}
                </Text>
                <Text style={[styles.listSubtitle, { color: colors.mutedForeground }]}>
                  {t("stat_cost_hint")}
                </Text>
                {stats.bestValue.map((item) => (
                  <CostPerWearCard key={item.id} item={item} />
                ))}
              </View>
            )}

            <View style={styles.listSection}>
              <Text style={[styles.listTitle, { color: colors.foreground }]}>
                {t("stat_needs_love")}
              </Text>
              <Text style={[styles.listSubtitle, { color: colors.mutedForeground }]}>
                {t("stat_barely_worn")}
              </Text>
              {stats.leastWorn.map((item) => (
                <CostPerWearCard key={item.id} item={item} />
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    gap: 2,
  },
  label: { fontSize: 10, fontWeight: "700", letterSpacing: 1.2 },
  title: { fontSize: 26, fontWeight: "700" },
  content: { paddingHorizontal: 18, paddingTop: 20, gap: 18 },
  empty: { borderRadius: 20, borderWidth: 1, padding: 32, alignItems: "center", gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: "700" },
  emptyBody: { fontSize: 13, textAlign: "center", lineHeight: 19 },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  summaryCard: {
    width: "47%",
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 4,
  },
  summaryValue: { fontSize: 24, fontWeight: "800", marginTop: 4 },
  summaryLabel: { fontSize: 12, fontWeight: "500", flexWrap: "wrap" },
  section: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: "700" },
  barChart: { gap: 10 },
  barRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  barLabel: { width: 88, fontSize: 12, fontWeight: "500", flexShrink: 0 },
  barTrack: { flex: 1, height: 10, borderRadius: 5, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 5 },
  barCount: { width: 24, fontSize: 12, fontWeight: "700", textAlign: "right" },
  workwearRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    marginTop: 2,
  },
  workwearText: { fontSize: 12, flex: 1, flexWrap: "wrap" },
  listSection: { gap: 10 },
  listTitle: { fontSize: 17, fontWeight: "700" },
  listSubtitle: { fontSize: 12, marginTop: -4 },
  cpwCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  cpwColor: { width: 36, height: 36, borderRadius: 10, flexShrink: 0 },
  cpwName: { fontSize: 14, fontWeight: "600" },
  cpwMeta: { fontSize: 11, marginTop: 2 },
  cpwBadge: { alignItems: "center", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  cpwValue: { fontSize: 15, fontWeight: "700" },
  cpwLabel: { fontSize: 9, fontWeight: "600", marginTop: 1 },
});
