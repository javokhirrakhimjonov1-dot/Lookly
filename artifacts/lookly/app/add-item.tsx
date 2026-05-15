import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import {
  type ClothingCategory,
  type Season,
  useWardrobe,
} from "@/contexts/WardrobeContext";

const CATEGORIES: { key: ClothingCategory; label: string; icon: React.ComponentProps<typeof Feather>["name"] }[] = [
  { key: "tops", label: "Tops", icon: "wind" },
  { key: "bottoms", label: "Bottoms", icon: "minus" },
  { key: "dresses", label: "Dresses", icon: "star" },
  { key: "outerwear", label: "Outerwear", icon: "layers" },
  { key: "shoes", label: "Shoes", icon: "chevrons-up" },
  { key: "accessories", label: "Accessories", icon: "circle" },
];

const SEASONS: Season[] = ["spring", "summer", "fall", "winter"];

const COLOR_SWATCHES: { name: string; hex: string }[] = [
  { name: "Black", hex: "#1C1512" },
  { name: "White", hex: "#FAF8F5" },
  { name: "Beige", hex: "#E8D5B7" },
  { name: "Navy", hex: "#1E3A5F" },
  { name: "Camel", hex: "#C19A6B" },
  { name: "Burgundy", hex: "#800020" },
  { name: "Olive", hex: "#6B7C4D" },
  { name: "Gray", hex: "#8A8A8A" },
  { name: "Blush", hex: "#E8A0A0" },
  { name: "Denim", hex: "#5B7FA6" },
  { name: "Terracotta", hex: "#C8906A" },
  { name: "Cream", hex: "#FAF0E6" },
];

export default function AddItemScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addItem } = useWardrobe();

  const [name, setName] = useState("");
  const [category, setCategory] = useState<ClothingCategory | null>(null);
  const [selectedColor, setSelectedColor] = useState<typeof COLOR_SWATCHES[number] | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const toggleSeason = (s: Season) => {
    setSeasons((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  const canSave = !!name.trim() && !!category && !!selectedColor && seasons.length > 0;

  const handleSave = async () => {
    if (!canSave || !category || !selectedColor) return;
    setIsSaving(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await addItem({
      name: name.trim(),
      category,
      color: selectedColor.name,
      colorHex: selectedColor.hex,
      seasons,
      tags: [category],
    });
    router.back();
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
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Add Item</Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={!canSave || isSaving}
          style={[
            styles.saveBtn,
            { backgroundColor: canSave ? colors.primary : colors.secondary },
          ]}
        >
          <Text
            style={[
              styles.saveBtnText,
              { color: canSave ? colors.primaryForeground : colors.mutedForeground },
            ]}
          >
            Save
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Platform.OS === "web" ? 60 : insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Item name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. White linen shirt"
            placeholderTextColor={colors.mutedForeground}
            style={[
              styles.input,
              { borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground },
            ]}
          />
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Category</Text>
          <View style={styles.categoryGrid}>
            {CATEGORIES.map((c) => (
              <Pressable
                key={c.key}
                onPress={() => setCategory(c.key)}
                style={({ pressed }) => [
                  styles.categoryBtn,
                  {
                    backgroundColor:
                      category === c.key ? colors.primary : colors.card,
                    borderColor:
                      category === c.key ? colors.primary : colors.border,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Feather
                  name={c.icon}
                  size={18}
                  color={category === c.key ? colors.primaryForeground : colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.categoryLabel,
                    {
                      color:
                        category === c.key
                          ? colors.primaryForeground
                          : colors.foreground,
                    },
                  ]}
                >
                  {c.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Color</Text>
          <View style={styles.colorGrid}>
            {COLOR_SWATCHES.map((c) => (
              <TouchableOpacity
                key={c.hex}
                onPress={() => setSelectedColor(c)}
                style={styles.colorItem}
              >
                <View
                  style={[
                    styles.colorSwatch,
                    {
                      backgroundColor: c.hex,
                      borderColor:
                        selectedColor?.hex === c.hex ? colors.accent : colors.border,
                      borderWidth: selectedColor?.hex === c.hex ? 2.5 : 1,
                    },
                  ]}
                >
                  {selectedColor?.hex === c.hex && (
                    <Feather
                      name="check"
                      size={14}
                      color={isLight(c.hex) ? "#1C1512" : "#FFFFFF"}
                    />
                  )}
                </View>
                <Text
                  style={[
                    styles.colorLabel,
                    {
                      color:
                        selectedColor?.hex === c.hex
                          ? colors.foreground
                          : colors.mutedForeground,
                    },
                  ]}
                >
                  {c.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Seasons</Text>
          <View style={styles.seasonsRow}>
            {SEASONS.map((s) => (
              <Pressable
                key={s}
                onPress={() => toggleSeason(s)}
                style={({ pressed }) => [
                  styles.seasonBtn,
                  {
                    backgroundColor: seasons.includes(s)
                      ? colors.primary
                      : colors.card,
                    borderColor: seasons.includes(s) ? colors.primary : colors.border,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.seasonLabel,
                    {
                      color: seasons.includes(s)
                        ? colors.primaryForeground
                        : colors.foreground,
                    },
                  ]}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function isLight(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  saveBtn: {
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 100,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 20,
    gap: 24,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  categoryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    width: "47%",
  },
  categoryLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  colorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  colorItem: {
    alignItems: "center",
    gap: 4,
    width: 52,
  },
  colorSwatch: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  colorLabel: {
    fontSize: 10,
    fontWeight: "500",
    textAlign: "center",
  },
  seasonsRow: {
    flexDirection: "row",
    gap: 10,
  },
  seasonBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  seasonLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
});
