import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import { type ClothingItem } from "@/contexts/WardrobeContext";

const CATEGORY_ICONS: Record<string, React.ComponentProps<typeof Feather>["name"]> = {
  tops: "wind",
  bottoms: "minus",
  dresses: "star",
  outerwear: "layers",
  shoes: "chevrons-up",
  accessories: "circle",
};

interface Props {
  item: ClothingItem;
  onPress?: () => void;
  onDelete?: () => void;
}

export default function ClothingItemCard({ item, onPress, onDelete }: Props) {
  const colors = useColors();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
      ]}
    >
      <View style={[styles.colorBlock, { backgroundColor: item.colorHex }]}>
        {item.imageUri ? (
          <Image
            source={{ uri: item.imageUri }}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <Feather
            name={CATEGORY_ICONS[item.category] ?? "circle"}
            size={22}
            color={isLight(item.colorHex) ? "#1C1512" : "#FAF8F5"}
          />
        )}
      </View>
      <View style={styles.info}>
        <Text
          style={[styles.name, { color: colors.foreground }]}
          numberOfLines={1}
        >
          {item.name}
        </Text>
        <Text style={[styles.meta, { color: colors.mutedForeground }]}>
          {item.category.charAt(0).toUpperCase() + item.category.slice(1)} · {item.color}
        </Text>
        <View style={styles.seasons}>
          {item.seasons.map((s) => (
            <View
              key={s}
              style={[styles.seasonPill, { backgroundColor: colors.secondary }]}
            >
              <Text style={[styles.seasonText, { color: colors.mutedForeground }]}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </Text>
            </View>
          ))}
        </View>
      </View>
      {onDelete && (
        <TouchableOpacity
          onPress={onDelete}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={[styles.deleteBtn, { backgroundColor: colors.secondary }]}
        >
          <Feather name="trash-2" size={14} color={colors.mutedForeground} />
        </TouchableOpacity>
      )}
    </Pressable>
  );
}

function isLight(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
    marginBottom: 10,
  },
  colorBlock: {
    width: 72,
    height: 84,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    overflow: "hidden",
    position: "relative",
  },
  info: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 3,
  },
  name: {
    fontSize: 15,
    fontWeight: "600",
  },
  meta: {
    fontSize: 12,
    fontWeight: "400",
  },
  seasons: {
    flexDirection: "row",
    gap: 5,
    marginTop: 4,
  },
  seasonPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
  },
  seasonText: {
    fontSize: 10,
    fontWeight: "600",
  },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
});
