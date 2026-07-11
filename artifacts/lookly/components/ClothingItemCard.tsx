import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useMemo, useState } from "react";
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

  const s = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.card,
        { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
      ]}
    >
      <View style={s.imageZone}>
        {item.imageUri ? (
          <Image
            source={{ uri: item.imageUri }}
            style={s.image}
            contentFit="contain"
            transition={250}
          />
        ) : (
          <View style={s.noImage}>
            <Feather name="shopping-bag" size={28} color={colors.mutedForeground} />
            <Text style={s.noImageLabel} numberOfLines={1}>{item.category}</Text>
          </View>
        )}

        <TouchableOpacity
          onPress={(e) => { e.stopPropagation(); setLiked((v) => !v); }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={s.heartBtn}
        >
          <Feather
            name={liked ? "heart" : "heart"}
            size={15}
            color={liked ? "#E05C5C" : colors.mutedForeground}
          />
        </TouchableOpacity>
      </View>

      <View style={s.info}>
        <Text style={s.name} numberOfLines={1}>{item.name}</Text>

        <View style={s.metaRow}>
          <View style={[s.swatch, { backgroundColor: item.colorHex }]} />
          <Text style={[s.metaText, { color: colors.mutedForeground }]} numberOfLines={1}>
            {categoryLabel}
          </Text>
        </View>

        {item.seasons.length > 0 && (
          <View style={s.pillRow}>
            {item.seasons.slice(0, 3).map((s) => (
              <View key={s} style={s.pill}>
                <Text style={s.pillText}>
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

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    card: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
      shadowColor: colors.foreground,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 3,
    },
    imageZone: {
      aspectRatio: 1,
      backgroundColor: colors.card,
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
      backgroundColor: colors.card,
      gap: 6,
    },
    noImageLabel: {
      fontSize: 10,
      fontWeight: "600",
      color: colors.mutedForeground,
      textTransform: "capitalize",
      letterSpacing: 0.4,
    },
    heartBtn: {
      position: "absolute",
      top: 8,
      right: 8,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: `rgba(255,255,255,0.88)`,
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
      color: colors.text,
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
      borderColor: `rgba(0,0,0,0.08)`,
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
      backgroundColor: colors.secondary,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 20,
    },
    pillText: {
      fontSize: 9,
      fontWeight: "600",
      color: colors.mutedForeground,
      letterSpacing: 0.3,
    },
  });
}
