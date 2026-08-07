import { Feather } from "@/components/FeatherIcon";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { type Deal } from "@/contexts/DealsContext";

function daysLeft(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));
}

interface Props {
  deal: Deal;
}

export default function DealCard({ deal }: Props) {
  const colors = useColors();
  const days = daysLeft(deal.expiresAt);
  const isUrgent = days <= 2;

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.discountBadge, { backgroundColor: deal.accentColor }]}>
        <Text style={[styles.discountText, { color: colors.card }]}>-{deal.discount}%</Text>
      </View>
      <View style={styles.content}>
        <View style={styles.topRow}>
          <View>
            <Text style={[styles.brandName, { color: colors.foreground }]}>{deal.brandName}</Text>
            <Text style={[styles.description, { color: colors.mutedForeground }]}>
              {deal.description}
            </Text>
          </View>
          {deal.isNew && (
            <View style={[styles.newBadge, { backgroundColor: colors.accent }]}>
              <Text style={[styles.newText, { color: colors.card }]}>NEW</Text>
            </View>
          )}
        </View>
        <View style={styles.footer}>
          <View style={styles.footerItem}>
            <Feather name="map-pin" size={12} color={colors.mutedForeground} />
            <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
              {deal.location}
            </Text>
          </View>
          <View style={styles.footerItem}>
            <Feather
              name="clock"
              size={12}
              color={isUrgent ? colors.destructive : colors.mutedForeground}
            />
            <Text
              style={[
                styles.footerText,
                { color: isUrgent ? colors.destructive : colors.mutedForeground, fontWeight: isUrgent ? "700" : "400" },
              ]}
            >
              {days === 0 ? "Ends today" : days === 1 ? "1 day left" : `${days} days left`}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    overflow: "hidden",
    marginBottom: 10,
  },
  discountBadge: {
    width: 72,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  discountText: {
    fontSize: 18,
    fontWeight: "800",
  },
  content: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  brandName: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 2,
  },
  description: {
    fontSize: 13,
    fontWeight: "400",
    maxWidth: 200,
  },
  newBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  newText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  footer: {
    flexDirection: "row",
    gap: 14,
  },
  footerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  footerText: {
    fontSize: 12,
    fontWeight: "400",
  },
});
