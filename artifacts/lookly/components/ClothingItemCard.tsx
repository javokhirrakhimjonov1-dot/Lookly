import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import { type ClothingItem } from "@/contexts/WardrobeContext";

interface Props {
  item: ClothingItem;
  onPress?: () => void;
  onDelete?: () => void;
}

export default function ClothingItemCard({ item, onPress }: Props) {
  const colors = useColors();
  const [liked, setLiked] = useState(false);

  const categoryLabel =
    item.category.charAt(0).toUpperCase() + item.category.slice(1);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
      ]}
    >
      {/* ── Image zone ── */}
      <View style={styles.imageZone}>
        {item.imageUri ? (
          <Image
            source={{ uri: item.imageUri }}
            style={styles.image}
            contentFit="contain"
            transition={250}
          />
        ) : (
          <View style={styles.noImage}>
            <View style={[styles.colorDot, { backgroundColor: item.colorHex }]} />
            <Feather name="shopping-bag" size={26} color="#C8B9AE" style={{ marginTop: 8 }} />
          </View>
        )}

        {/* Heart button — top right */}
        <TouchableOpacity
          onPress={(e) => { e.stopPropagation(); setLiked((v) => !v); }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.heartBtn}
        >
          <Feather
            name={liked ? "heart" : "heart"}
            size={15}
            color={liked ? "#E05C5C" : "#B0A9A3"}
          />
        </TouchableOpacity>
      </View>

      {/* ── Metadata ── */}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{item.name}</Text>

        <View style={styles.metaRow}>
          <View style={[styles.swatch, { backgroundColor: item.colorHex }]} />
          <Text style={[styles.metaText, { color: "#78716C" }]} numberOfLines={1}>
            {categoryLabel}
          </Text>
        </View>

        {item.seasons.length > 0 && (
          <View style={styles.pillRow}>
            {item.seasons.slice(0, 3).map((s) => (
              <View key={s} style={styles.pill}>
                <Text style={styles.pillText}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#EAEAEA",
    overflow: "hidden",
    // Shadow — iOS / web
    shadowColor: "#1C1512",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    // Shadow — Android
    elevation: 3,
  },
  imageZone: {
    aspectRatio: 1,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  noImage: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    gap: 0,
  },
  colorDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  heartBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.88)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  info: {
    padding: 10,
    gap: 5,
  },
  name: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1C1512",
    letterSpacing: 0.1,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  swatch: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
    borderWidth: 0.5,
    borderColor: "rgba(0,0,0,0.08)",
  },
  metaText: {
    fontSize: 11,
    fontWeight: "500",
    flexShrink: 1,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 1,
  },
  pill: {
    backgroundColor: "#F2EFE9",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 20,
  },
  pillText: {
    fontSize: 9,
    fontWeight: "600",
    color: "#78716C",
    letterSpacing: 0.3,
  },
});
