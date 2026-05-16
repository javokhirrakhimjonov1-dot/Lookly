import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { type ClothingCategory, type ClothingItem, type Season, useWardrobe } from "@/contexts/WardrobeContext";
import { useSocial } from "@/contexts/SocialContext";
import { useWeather } from "@/contexts/WeatherContext";

type OutfitSlotKey = "outerwear" | "tops" | "bottoms" | "dresses" | "shoes" | "accessories";

const SLOT_CONFIG: {
  key: OutfitSlotKey;
  label: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  acceptsCategories: ClothingCategory[];
  flex?: number;
}[] = [
  { key: "outerwear", label: "Outerwear", icon: "layers", acceptsCategories: ["outerwear"], flex: 1 },
  { key: "tops", label: "Top", icon: "wind", acceptsCategories: ["tops"], flex: 1 },
  { key: "dresses", label: "Dress", icon: "star", acceptsCategories: ["dresses"], flex: 2 },
  { key: "bottoms", label: "Bottom", icon: "minus", acceptsCategories: ["bottoms"], flex: 1 },
  { key: "shoes", label: "Shoes", icon: "chevrons-up", acceptsCategories: ["shoes"], flex: 1 },
  { key: "accessories", label: "Accessory", icon: "circle", acceptsCategories: ["accessories"], flex: 1 },
];

function categoryToSlotKey(cat: ClothingCategory): OutfitSlotKey {
  return cat as OutfitSlotKey;
}

function isLight(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}

function getCurrentSeason(): Season {
  const m = new Date().getMonth();
  if (m >= 2 && m <= 4) return "spring";
  if (m >= 5 && m <= 7) return "summer";
  if (m >= 8 && m <= 10) return "fall";
  return "winter";
}

interface SlotCardProps {
  slotKey: OutfitSlotKey;
  label: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  assignedItem: ClothingItem | null;
  onClear: () => void;
  isDropTarget: boolean;
  flex?: number;
}

function SlotCard({ slotKey, label, icon, assignedItem, onClear, isDropTarget, flex = 1 }: SlotCardProps) {
  const colors = useColors();
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  React.useEffect(() => {
    if (assignedItem) {
      scale.value = withSpring(1.04, { damping: 10 }, () => {
        scale.value = withSpring(1);
      });
    }
  }, [assignedItem?.id]);

  React.useEffect(() => {
    if (isDropTarget) {
      scale.value = withTiming(1.03, { duration: 150 });
    } else {
      scale.value = withTiming(1, { duration: 150 });
    }
  }, [isDropTarget]);

  return (
    <Animated.View
      style={[
        styles.slot,
        animStyle,
        {
          flex,
          backgroundColor: assignedItem
            ? assignedItem.colorHex
            : isDropTarget
            ? colors.secondary
            : colors.card,
          borderColor: isDropTarget
            ? colors.accent
            : assignedItem
            ? "transparent"
            : colors.border,
          borderStyle: assignedItem ? "solid" : "dashed",
        },
      ]}
    >
      {assignedItem ? (
        <>
          <View style={styles.slotFilledContent}>
            <Text
              style={[
                styles.slotFilledName,
                { color: isLight(assignedItem.colorHex) ? "#1C1512" : "#FAF8F5" },
              ]}
              numberOfLines={2}
            >
              {assignedItem.name}
            </Text>
            <Text
              style={[
                styles.slotFilledSub,
                {
                  color: isLight(assignedItem.colorHex)
                    ? "rgba(28,21,18,0.6)"
                    : "rgba(250,248,245,0.7)",
                },
              ]}
            >
              {label}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onClear}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={[
              styles.clearBtn,
              {
                backgroundColor: isLight(assignedItem.colorHex)
                  ? "rgba(28,21,18,0.15)"
                  : "rgba(250,248,245,0.2)",
              },
            ]}
          >
            <Feather
              name="x"
              size={12}
              color={isLight(assignedItem.colorHex) ? "#1C1512" : "#FAF8F5"}
            />
          </TouchableOpacity>
        </>
      ) : (
        <View style={styles.slotEmpty}>
          <Feather name={icon} size={18} color={isDropTarget ? colors.accent : colors.border} />
          <Text
            style={[
              styles.slotLabel,
              { color: isDropTarget ? colors.accent : colors.mutedForeground },
            ]}
          >
            {label}
          </Text>
        </View>
      )}
    </Animated.View>
  );
}

interface DraggableItemProps {
  item: ClothingItem;
  isAssigned: boolean;
  onTap: () => void;
}

function DraggableItem({ item, isAssigned, onTap }: DraggableItemProps) {
  const colors = useColors();
  const scale = useSharedValue(1);
  const [pressing, setPressing] = useState(false);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: isAssigned ? 0.5 : 1,
  }));

  const handlePressIn = () => {
    setPressing(true);
    scale.value = withSpring(0.92, { damping: 12 });
  };

  const handlePressOut = () => {
    setPressing(false);
    scale.value = withSpring(1, { damping: 12 });
  };

  const handlePress = () => {
    if (!isAssigned) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      scale.value = withSpring(1.12, { damping: 10 }, () => {
        scale.value = withSpring(1);
      });
    }
    onTap();
  };

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      style={styles.draggableWrap}
    >
      <Animated.View style={animStyle}>
        <View style={[styles.itemCard, { backgroundColor: item.colorHex }]}>
          {isAssigned && (
            <View
              style={[
                styles.assignedOverlay,
                {
                  backgroundColor: isLight(item.colorHex)
                    ? "rgba(28,21,18,0.15)"
                    : "rgba(250,248,245,0.2)",
                },
              ]}
            >
              <Feather
                name="check"
                size={16}
                color={isLight(item.colorHex) ? "#1C1512" : "#FAF8F5"}
              />
            </View>
          )}
        </View>
        <Text
          style={[styles.itemCardName, { color: colors.foreground }]}
          numberOfLines={1}
        >
          {item.name}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const FILTER_CATEGORIES: { key: "all" | ClothingCategory; label: string }[] = [
  { key: "all", label: "All" },
  { key: "tops", label: "Tops" },
  { key: "bottoms", label: "Bottoms" },
  { key: "dresses", label: "Dresses" },
  { key: "outerwear", label: "Outerwear" },
  { key: "shoes", label: "Shoes" },
  { key: "accessories", label: "Accessories" },
];

export default function OutfitBuilderScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { items } = useWardrobe();
  const { addLook } = useSocial();
  const { condition, temperature } = useWeather();

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [assigned, setAssigned] = useState<Partial<Record<OutfitSlotKey, ClothingItem>>>({});
  const [filterCat, setFilterCat] = useState<"all" | ClothingCategory>("all");
  const [dropTarget, setDropTarget] = useState<OutfitSlotKey | null>(null);

  const assignItem = useCallback((item: ClothingItem) => {
    const slotKey = categoryToSlotKey(item.category);
    setAssigned((prev) => {
      if (prev[slotKey]?.id === item.id) {
        const next = { ...prev };
        delete next[slotKey];
        return next;
      }
      return { ...prev, [slotKey]: item };
    });
  }, []);

  const clearSlot = useCallback((slotKey: OutfitSlotKey) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAssigned((prev) => {
      const next = { ...prev };
      delete next[slotKey];
      return next;
    });
  }, []);

  const handleAutoSuggest = () => {
    const season = getCurrentSeason();
    const seasonItems = items.filter((i) => i.seasons.includes(season));
    const next: Partial<Record<OutfitSlotKey, ClothingItem>> = {};
    for (const cat of ["tops", "bottoms", "outerwear", "shoes", "accessories", "dresses"] as ClothingCategory[]) {
      const match = seasonItems.find((i) => i.category === cat);
      if (match) next[categoryToSlotKey(cat)] = match;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setAssigned(next);
  };

  const handleClearAll = () => {
    setAssigned({});
  };

  const handlePost = async () => {
    const pieces = Object.values(assigned);
    if (pieces.length === 0) {
      Alert.alert("Empty look", "Add at least one item to your look first.");
      return;
    }
    const itemNames = pieces.map((i) => i!.name).join(", ");
    await addLook({
      userId: "me",
      userName: "You",
      userHandle: "my.lookly",
      caption: `My outfit: ${itemNames}`,
      weather: condition,
      temperature,
      tags: ["ootd", "mylook"],
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  const filteredItems =
    filterCat === "all" ? items : items.filter((i) => i.category === filterCat);

  const assignedIds = new Set(Object.values(assigned).filter(Boolean).map((i) => i!.id));
  const pieceCount = Object.keys(assigned).length;

  const hasDress = !!assigned["dresses"];

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
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Make Your Look</Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
            {pieceCount === 0 ? "Tap items below to build your outfit" : `${pieceCount} piece${pieceCount > 1 ? "s" : ""} selected`}
          </Text>
        </View>
        <TouchableOpacity
          onPress={handleAutoSuggest}
          style={[styles.autoBtn, { backgroundColor: colors.secondary }]}
        >
          <Feather name="zap" size={14} color={colors.accent} />
          <Text style={[styles.autoBtnText, { color: colors.accent }]}>Auto</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Platform.OS === "web" ? 80 : insets.bottom + 80 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.canvas}>
          <Text style={[styles.canvasLabel, { color: colors.mutedForeground }]}>OUTFIT CANVAS</Text>

          <View style={styles.canvasRow}>
            <SlotCard
              slotKey="outerwear"
              label="Outerwear"
              icon="layers"
              assignedItem={assigned["outerwear"] ?? null}
              onClear={() => clearSlot("outerwear")}
              isDropTarget={dropTarget === "outerwear"}
              flex={1}
            />
            <SlotCard
              slotKey="tops"
              label="Top"
              icon="wind"
              assignedItem={hasDress ? null : (assigned["tops"] ?? null)}
              onClear={() => clearSlot("tops")}
              isDropTarget={dropTarget === "tops"}
              flex={1}
            />
          </View>

          {hasDress ? (
            <View style={styles.canvasRow}>
              <SlotCard
                slotKey="dresses"
                label="Dress"
                icon="star"
                assignedItem={assigned["dresses"] ?? null}
                onClear={() => clearSlot("dresses")}
                isDropTarget={dropTarget === "dresses"}
                flex={1}
              />
            </View>
          ) : (
            <View style={styles.canvasRow}>
              <SlotCard
                slotKey="bottoms"
                label="Bottom"
                icon="minus"
                assignedItem={assigned["bottoms"] ?? null}
                onClear={() => clearSlot("bottoms")}
                isDropTarget={dropTarget === "bottoms"}
                flex={1}
              />
            </View>
          )}

          <View style={styles.canvasRow}>
            <SlotCard
              slotKey="shoes"
              label="Shoes"
              icon="chevrons-up"
              assignedItem={assigned["shoes"] ?? null}
              onClear={() => clearSlot("shoes")}
              isDropTarget={dropTarget === "shoes"}
              flex={1}
            />
            <SlotCard
              slotKey="accessories"
              label="Accessory"
              icon="circle"
              assignedItem={assigned["accessories"] ?? null}
              onClear={() => clearSlot("accessories")}
              isDropTarget={dropTarget === "accessories"}
              flex={1}
            />
          </View>

          <View style={styles.canvasActions}>
            <TouchableOpacity
              onPress={handleClearAll}
              style={[styles.clearAllBtn, { borderColor: colors.border }]}
            >
              <Feather name="trash-2" size={14} color={colors.mutedForeground} />
              <Text style={[styles.clearAllText, { color: colors.mutedForeground }]}>Clear all</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handlePost}
              style={[
                styles.postBtn,
                {
                  backgroundColor: pieceCount > 0 ? colors.primary : colors.secondary,
                },
              ]}
            >
              <Feather
                name="camera"
                size={14}
                color={pieceCount > 0 ? colors.primaryForeground : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.postBtnText,
                  { color: pieceCount > 0 ? colors.primaryForeground : colors.mutedForeground },
                ]}
              >
                Post Look
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <View style={styles.pickerSection}>
          <Text style={[styles.pickerTitle, { color: colors.foreground }]}>Your Wardrobe</Text>
          {items.length === 0 ? (
            <View style={[styles.emptyWardrobe, { backgroundColor: colors.secondary }]}>
              <Feather name="layers" size={28} color={colors.border} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                No items yet
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
                Add clothes to your wardrobe first
              </Text>
              <TouchableOpacity
                onPress={() => router.push("/add-item")}
                style={[styles.addBtn, { backgroundColor: colors.primary }]}
              >
                <Text style={[styles.addBtnText, { color: colors.primaryForeground }]}>
                  Add items
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterPills}
              >
                {FILTER_CATEGORIES.map((c) => {
                  const count =
                    c.key === "all"
                      ? items.length
                      : items.filter((i) => i.category === c.key).length;
                  if (c.key !== "all" && count === 0) return null;
                  return (
                    <Pressable
                      key={c.key}
                      onPress={() => setFilterCat(c.key)}
                      style={[
                        styles.filterPill,
                        {
                          backgroundColor:
                            filterCat === c.key ? colors.primary : colors.secondary,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.filterPillText,
                          {
                            color:
                              filterCat === c.key
                                ? colors.primaryForeground
                                : colors.mutedForeground,
                          },
                        ]}
                      >
                        {c.label} {count}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {filteredItems.length === 0 ? (
                <Text style={[styles.noItems, { color: colors.mutedForeground }]}>
                  No items in this category
                </Text>
              ) : (
                <View style={styles.itemGrid}>
                  {filteredItems.map((item) => (
                    <DraggableItem
                      key={item.id}
                      item={item}
                      isAssigned={assignedIds.has(item.id)}
                      onTap={() => assignItem(item)}
                    />
                  ))}
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const SLOT_HEIGHT = 90;

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  headerSub: {
    fontSize: 12,
    fontWeight: "400",
    marginTop: 1,
  },
  autoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 100,
  },
  autoBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
  scrollContent: {
    paddingTop: 18,
    gap: 0,
  },
  canvas: {
    paddingHorizontal: 18,
    gap: 10,
  },
  canvasLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  canvasRow: {
    flexDirection: "row",
    gap: 10,
    minHeight: SLOT_HEIGHT,
  },
  slot: {
    borderRadius: 16,
    borderWidth: 1.5,
    minHeight: SLOT_HEIGHT,
    overflow: "hidden",
    position: "relative",
  },
  slotEmpty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 12,
  },
  slotLabel: {
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
  },
  slotFilledContent: {
    flex: 1,
    padding: 10,
    justifyContent: "flex-end",
  },
  slotFilledName: {
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 16,
  },
  slotFilledSub: {
    fontSize: 10,
    fontWeight: "500",
    marginTop: 2,
  },
  clearBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  canvasActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  clearAllBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  clearAllText: {
    fontSize: 14,
    fontWeight: "500",
  },
  postBtn: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 12,
    borderRadius: 12,
  },
  postBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
  divider: {
    height: 1,
    marginHorizontal: 18,
    marginVertical: 20,
  },
  pickerSection: {
    paddingHorizontal: 18,
    gap: 14,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  emptyWardrobe: {
    borderRadius: 16,
    padding: 28,
    alignItems: "center",
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: "center",
  },
  addBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 100,
    marginTop: 6,
  },
  addBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
  filterPills: {
    gap: 8,
    paddingRight: 18,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 100,
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: "600",
  },
  noItems: {
    fontSize: 14,
    textAlign: "center",
    paddingVertical: 24,
  },
  itemGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  draggableWrap: {
    width: "30%",
    alignItems: "center",
    gap: 6,
  },
  itemCard: {
    width: 72,
    height: 72,
    borderRadius: 16,
    overflow: "hidden",
    position: "relative",
  },
  assignedOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  itemCardName: {
    fontSize: 11,
    fontWeight: "500",
    textAlign: "center",
    maxWidth: 80,
  },
});
