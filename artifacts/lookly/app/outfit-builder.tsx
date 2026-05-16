import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { router } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
import {
  type ClothingCategory,
  type ClothingItem,
  type Season,
  useWardrobe,
} from "@/contexts/WardrobeContext";
import { useSocial } from "@/contexts/SocialContext";
import { useWeather } from "@/contexts/WeatherContext";
import { useUserProfile } from "@/contexts/UserProfileContext";

type OutfitSlotKey = "outerwear" | "tops" | "bottoms" | "dresses" | "shoes" | "accessories";

function getCurrentSeason(): Season {
  const m = new Date().getMonth();
  if (m >= 2 && m <= 4) return "spring";
  if (m >= 5 && m <= 7) return "summer";
  if (m >= 8 && m <= 10) return "fall";
  return "winter";
}

function isLight(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}

function categoryToSlotKey(cat: ClothingCategory): OutfitSlotKey {
  return cat as OutfitSlotKey;
}

const API_BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

async function generateOutfitPreview(
  items: ClothingItem[],
  weather: string,
  temperature: number,
  userBodyPhotoBase64?: string | null,
  userBodyPhotoMime?: string
): Promise<string> {
  const body = {
    items: items.map((i) => ({
      name: i.name,
      color: i.color,
      colorHex: i.colorHex,
      category: i.category,
    })),
    weather,
    temperature,
    userBodyPhotoBase64: userBodyPhotoBase64 ?? undefined,
    userBodyPhotoMime: userBodyPhotoBase64 ? (userBodyPhotoMime ?? "image/jpeg") : undefined,
  };

  const res = await fetch(`${API_BASE}/outfit-preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let errMsg = `Preview unavailable (${res.status})`;
    try {
      const errBody = await res.json() as { error?: string };
      if (errBody.error) errMsg = errBody.error;
    } catch {}
    throw new Error(errMsg);
  }
  const data = await res.json() as { image: string };
  return data.image;
}

interface SlotCardProps {
  slotKey: OutfitSlotKey;
  label: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  assignedItem: ClothingItem | null;
  onClear: () => void;
  flex?: number;
  isLocked?: boolean;
}

function SlotCard({ slotKey: _slotKey, label, icon, assignedItem, onClear, flex = 1, isLocked }: SlotCardProps) {
  const colors = useColors();
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  React.useEffect(() => {
    if (assignedItem) {
      scale.value = withSpring(1.05, { damping: 10 }, () => {
        scale.value = withSpring(1);
      });
    }
  }, [assignedItem?.id]);

  return (
    <Animated.View
      style={[
        styles.slot,
        animStyle,
        {
          flex,
          backgroundColor: assignedItem ? assignedItem.colorHex : colors.card,
          borderColor: assignedItem ? "transparent" : colors.border,
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
          {isLocked && (
            <View
              style={[
                styles.lockBadge,
                {
                  backgroundColor: isLight(assignedItem.colorHex)
                    ? "rgba(28,21,18,0.22)"
                    : "rgba(250,248,245,0.25)",
                },
              ]}
            >
              <Feather
                name="lock"
                size={9}
                color={isLight(assignedItem.colorHex) ? "#1C1512" : "#FAF8F5"}
              />
            </View>
          )}
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
          <Feather name={icon} size={18} color={colors.border} />
          <Text style={[styles.slotLabel, { color: colors.mutedForeground }]}>{label}</Text>
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

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: isAssigned ? 0.5 : 1,
  }));

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
                    ? "rgba(28,21,18,0.18)"
                    : "rgba(250,248,245,0.25)",
                },
              ]}
            >
              <Feather
                name="check"
                size={18}
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
  const { items, saveOutfit, savedOutfits } = useWardrobe();
  const { addLook } = useSocial();
  const { condition, temperature } = useWeather();
  const { bodyPhotoBase64, bodyPhotoMime } = useUserProfile();

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [assigned, setAssigned] = useState<Partial<Record<OutfitSlotKey, ClothingItem>>>({});
  const [lockedSlots, setLockedSlots] = useState<Set<OutfitSlotKey>>(new Set());
  const [lastAutoIds, setLastAutoIds] = useState<Set<string>>(new Set());
  const [hasDoneAuto, setHasDoneAuto] = useState(false);
  const [filterCat, setFilterCat] = useState<"all" | ClothingCategory>("all");

  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const [showSaveModal, setShowSaveModal] = useState(false);
  const [outfitName, setOutfitName] = useState("");

  const [showSavedOutfits, setShowSavedOutfits] = useState(false);

  const assignItem = useCallback((item: ClothingItem) => {
    const slotKey = categoryToSlotKey(item.category);
    setAssigned((prev) => {
      if (prev[slotKey]?.id === item.id) {
        const next = { ...prev };
        delete next[slotKey];
        setLockedSlots((ls) => { const n = new Set(ls); n.delete(slotKey); return n; });
        return next;
      }
      setLockedSlots((ls) => new Set([...ls, slotKey]));
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
    setLockedSlots((ls) => { const n = new Set(ls); n.delete(slotKey); return n; });
  }, []);

  const handleAutoSuggest = () => {
    const season = getCurrentSeason();
    const next = { ...assigned };
    const newAutoIds = new Set<string>();

    for (const cat of [
      "tops",
      "bottoms",
      "outerwear",
      "shoes",
      "accessories",
      "dresses",
    ] as ClothingCategory[]) {
      const slotKey = categoryToSlotKey(cat);
      if (lockedSlots.has(slotKey)) {
        if (next[slotKey]) newAutoIds.delete(next[slotKey]!.id);
        continue;
      }

      const all = items.filter((i) => i.category === cat);
      if (all.length === 0) continue;

      const seasonFresh = all.filter((i) => i.seasons.includes(season) && !lastAutoIds.has(i.id));
      const allFresh = all.filter((i) => !lastAutoIds.has(i.id));
      const pool = seasonFresh.length > 0 ? seasonFresh : allFresh.length > 0 ? allFresh : all;

      const pick = pool[Math.floor(Math.random() * pool.length)]!;
      next[slotKey] = pick;
      newAutoIds.add(pick.id);
    }

    setLastAutoIds(newAutoIds);
    setHasDoneAuto(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setAssigned(next);
  };

  const handleClearAll = () => {
    setAssigned({});
    setPreviewImage(null);
    setLockedSlots(new Set());
    setLastAutoIds(new Set());
    setHasDoneAuto(false);
  };

  const handleGeneratePreview = async (forceRegenerate = false) => {
    const pieces = Object.values(assigned).filter(Boolean) as ClothingItem[];
    if (pieces.length === 0) {
      Alert.alert("No items selected", "Add at least one item to preview the look.");
      return;
    }
    if (previewImage && !forceRegenerate) {
      setShowPreview(true);
      return;
    }
    setIsGenerating(true);
    setShowPreview(true);
    try {
      const img = await generateOutfitPreview(pieces, condition, temperature, bodyPhotoBase64, bodyPhotoMime);
      setPreviewImage(img);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not generate the look preview. Please try again.";
      Alert.alert("Preview failed", msg);
      setShowPreview(false);
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePost = async () => {
    const pieces = Object.values(assigned).filter(Boolean) as ClothingItem[];
    if (pieces.length === 0) {
      Alert.alert("Empty look", "Add at least one item to your look first.");
      return;
    }
    const itemNames = pieces.map((i) => i.name).join(", ");
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

  const handleSaveOutfit = async () => {
    if (!outfitName.trim()) return;
    await saveOutfit(outfitName.trim(), assigned, previewImage ?? undefined);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowSaveModal(false);
    setOutfitName("");
    Alert.alert("Saved!", `"${outfitName.trim()}" added to your outfit templates.`);
  };

  const handleLoadSavedOutfit = (outfit: (typeof savedOutfits)[number]) => {
    setAssigned(outfit.items);
    if (outfit.previewImage) {
      setPreviewImage(outfit.previewImage);
      setShowSavedOutfits(false);
      setShowPreview(true);
    } else {
      setPreviewImage(null);
      setShowSavedOutfits(false);
    }
  };

  const filteredItems =
    filterCat === "all" ? items : items.filter((i) => i.category === filterCat);

  const assignedIds = new Set(
    Object.values(assigned)
      .filter(Boolean)
      .map((i) => i!.id)
  );
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
            {pieceCount === 0
              ? "Tap items below to build your outfit"
              : `${pieceCount} piece${pieceCount > 1 ? "s" : ""} selected`}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => setShowSavedOutfits(true)}
          style={[styles.savedBtn, { backgroundColor: colors.secondary }]}
        >
          <Feather name="bookmark" size={14} color={colors.accent} />
          {savedOutfits.length > 0 && (
            <Text style={[styles.savedBadge, { color: colors.accent }]}>{savedOutfits.length}</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleAutoSuggest}
          style={[styles.autoBtn, { backgroundColor: colors.secondary, marginLeft: 8 }]}
        >
          <Feather name={hasDoneAuto ? "refresh-cw" : "zap"} size={14} color={colors.accent} />
          <Text style={[styles.autoBtnText, { color: colors.accent }]}>
            {hasDoneAuto ? "Reshuffle" : "Auto"}
          </Text>
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
          <Text style={[styles.canvasLabel, { color: colors.mutedForeground }]}>
            OUTFIT CANVAS
          </Text>

          <View style={styles.canvasRow}>
            <SlotCard
              slotKey="outerwear"
              label="Outerwear"
              icon="layers"
              assignedItem={assigned["outerwear"] ?? null}
              onClear={() => clearSlot("outerwear")}
              isLocked={lockedSlots.has("outerwear")}
            />
            <SlotCard
              slotKey="tops"
              label="Top"
              icon="wind"
              assignedItem={hasDress ? null : (assigned["tops"] ?? null)}
              onClear={() => clearSlot("tops")}
              isLocked={lockedSlots.has("tops")}
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
                isLocked={lockedSlots.has("dresses")}
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
                isLocked={lockedSlots.has("bottoms")}
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
              isLocked={lockedSlots.has("shoes")}
            />
            <SlotCard
              slotKey="accessories"
              label="Accessory"
              icon="circle"
              assignedItem={assigned["accessories"] ?? null}
              onClear={() => clearSlot("accessories")}
              isLocked={lockedSlots.has("accessories")}
            />
          </View>

          <TouchableOpacity
            onPress={() => handleGeneratePreview(false)}
            disabled={pieceCount === 0 || isGenerating}
            style={[
              styles.previewBtn,
              {
                backgroundColor: pieceCount > 0 ? colors.accent : colors.secondary,
              },
            ]}
          >
            {isGenerating ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Feather
                name={previewImage ? "image" : "eye"}
                size={16}
                color={pieceCount > 0 ? "#FFFFFF" : colors.mutedForeground}
              />
            )}
            <Text
              style={[
                styles.previewBtnText,
                { color: pieceCount > 0 ? "#FFFFFF" : colors.mutedForeground },
              ]}
            >
              {isGenerating
                ? "Generating look..."
                : previewImage
                ? "View Look"
                : "Preview on Model"}
            </Text>
          </TouchableOpacity>

          <View style={styles.canvasActions}>
            <TouchableOpacity
              onPress={handleClearAll}
              style={[styles.actionBtn, { borderColor: colors.border }]}
            >
              <Feather name="trash-2" size={14} color={colors.mutedForeground} />
              <Text style={[styles.actionBtnText, { color: colors.mutedForeground }]}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                if (pieceCount === 0) return;
                setShowSaveModal(true);
              }}
              style={[
                styles.actionBtn,
                {
                  borderColor: pieceCount > 0 ? colors.accent : colors.border,
                  backgroundColor: pieceCount > 0 ? colors.secondary : "transparent",
                },
              ]}
            >
              <Feather
                name="bookmark"
                size={14}
                color={pieceCount > 0 ? colors.accent : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.actionBtnText,
                  { color: pieceCount > 0 ? colors.accent : colors.mutedForeground },
                ]}
              >
                Save Template
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handlePost}
              style={[
                styles.actionBtn,
                {
                  borderColor: pieceCount > 0 ? colors.primary : colors.border,
                  backgroundColor: pieceCount > 0 ? colors.primary : "transparent",
                  flex: 1.2,
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
                  styles.actionBtnText,
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
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No items yet</Text>
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

      <Modal visible={showPreview} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.previewModal, { backgroundColor: colors.background }]}>
          <View
            style={[
              styles.previewModalHeader,
              {
                borderBottomColor: colors.border,
                paddingTop: Platform.OS === "web" ? 24 : 20,
              },
            ]}
          >
            <TouchableOpacity onPress={() => setShowPreview(false)}>
              <Feather name="x" size={22} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={[styles.previewModalTitle, { color: colors.foreground }]}>
              Your Look Preview
            </Text>
            <View style={styles.previewHeaderActions}>
              <TouchableOpacity
                onPress={() => handleGeneratePreview(true)}
                disabled={isGenerating}
                style={[styles.regenBtn, { backgroundColor: colors.secondary }]}
              >
                <Feather name="refresh-cw" size={13} color={colors.mutedForeground} />
                <Text style={[styles.regenBtnText, { color: colors.mutedForeground }]}>Regenerate</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setShowPreview(false);
                  if (pieceCount > 0) setShowSaveModal(true);
                }}
                style={[styles.saveFromPreviewBtn, { backgroundColor: colors.secondary }]}
              >
                <Feather name="bookmark" size={14} color={colors.accent} />
                <Text style={[styles.saveFromPreviewText, { color: colors.accent }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView contentContainerStyle={styles.previewModalContent}>
            {isGenerating ? (
              <View style={[styles.generatingContainer, { backgroundColor: colors.secondary }]}>
                <ActivityIndicator size="large" color={colors.accent} />
                <Text style={[styles.generatingText, { color: colors.foreground }]}>
                  Generating your look...
                </Text>
                <Text style={[styles.generatingSubText, { color: colors.mutedForeground }]}>
                  Our AI is styling your outfit on a model
                </Text>
              </View>
            ) : previewImage ? (
              <>
                <Image
                  source={{ uri: `data:image/png;base64,${previewImage}` }}
                  style={styles.previewImage}
                  contentFit="cover"
                />
                <View style={styles.previewPieces}>
                  <Text style={[styles.previewPiecesLabel, { color: colors.mutedForeground }]}>
                    OUTFIT PIECES
                  </Text>
                  {Object.entries(assigned).map(([key, item]) => {
                    if (!item) return null;
                    return (
                      <View
                        key={key}
                        style={[styles.previewPieceRow, { borderColor: colors.border }]}
                      >
                        <View
                          style={[styles.previewPieceColor, { backgroundColor: item.colorHex }]}
                        />
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[styles.previewPieceName, { color: colors.foreground }]}
                          >
                            {item.name}
                          </Text>
                          <Text
                            style={[styles.previewPieceCat, { color: colors.mutedForeground }]}
                          >
                            {item.color} · {item.category}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </>
            ) : null}
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={showSaveModal}
        animationType="slide"
        presentationStyle="pageSheet"
        transparent
      >
        <View style={styles.saveModalOverlay}>
          <View
            style={[
              styles.saveModalCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.saveModalTitle, { color: colors.foreground }]}>
              Save Outfit Template
            </Text>
            <Text style={[styles.saveModalSubtitle, { color: colors.mutedForeground }]}>
              Give this outfit a name so you can reuse it later
            </Text>
            <TextInput
              value={outfitName}
              onChangeText={setOutfitName}
              placeholder="e.g. Friday Office Look"
              placeholderTextColor={colors.mutedForeground}
              autoFocus
              style={[
                styles.saveModalInput,
                { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background },
              ]}
            />
            <View style={styles.saveModalActions}>
              <TouchableOpacity
                onPress={() => setShowSaveModal(false)}
                style={[styles.saveModalCancel, { borderColor: colors.border }]}
              >
                <Text style={[styles.saveModalCancelText, { color: colors.mutedForeground }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveOutfit}
                disabled={!outfitName.trim()}
                style={[
                  styles.saveModalConfirm,
                  {
                    backgroundColor: outfitName.trim() ? colors.primary : colors.secondary,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.saveModalConfirmText,
                    {
                      color: outfitName.trim()
                        ? colors.primaryForeground
                        : colors.mutedForeground,
                    },
                  ]}
                >
                  Save
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showSavedOutfits}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={[styles.savedOutfitsModal, { backgroundColor: colors.background }]}>
          <View
            style={[
              styles.savedOutfitsHeader,
              {
                borderBottomColor: colors.border,
                paddingTop: Platform.OS === "web" ? 24 : 20,
              },
            ]}
          >
            <TouchableOpacity onPress={() => setShowSavedOutfits(false)}>
              <Feather name="x" size={22} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={[styles.savedOutfitsTitle, { color: colors.foreground }]}>
              Saved Outfits
            </Text>
            <View style={{ width: 22 }} />
          </View>
          <ScrollView contentContainerStyle={styles.savedOutfitsList}>
            {savedOutfits.length === 0 ? (
              <View style={styles.savedOutfitsEmpty}>
                <Feather name="bookmark" size={36} color={colors.border} />
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                  No saved outfits yet
                </Text>
                <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
                  Build a look and tap "Save Template"
                </Text>
              </View>
            ) : (
              savedOutfits.map((outfit) => {
                const pieces = Object.values(outfit.items).filter(Boolean) as ClothingItem[];
                return (
                  <TouchableOpacity
                    key={outfit.id}
                    onPress={() => handleLoadSavedOutfit(outfit)}
                    style={[
                      styles.savedOutfitCard,
                      { backgroundColor: colors.card, borderColor: colors.border },
                    ]}
                  >
                    {outfit.previewImage ? (
                      <Image
                        source={{ uri: `data:image/png;base64,${outfit.previewImage}` }}
                        style={styles.savedOutfitThumb}
                        contentFit="cover"
                      />
                    ) : (
                      <View
                        style={[styles.savedOutfitThumb, { backgroundColor: colors.secondary }]}
                      >
                        <View style={styles.colorSwatches}>
                          {pieces.slice(0, 4).map((p, i) => (
                            <View
                              key={i}
                              style={[
                                styles.miniSwatch,
                                { backgroundColor: p.colorHex, marginLeft: i > 0 ? -4 : 0 },
                              ]}
                            />
                          ))}
                        </View>
                      </View>
                    )}
                    <View style={styles.savedOutfitInfo}>
                      <Text style={[styles.savedOutfitName, { color: colors.foreground }]}>
                        {outfit.name}
                      </Text>
                      <Text style={[styles.savedOutfitMeta, { color: colors.mutedForeground }]}>
                        {pieces.length} piece{pieces.length !== 1 ? "s" : ""} · {new Date(outfit.createdAt).toLocaleDateString()}
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const SLOT_HEIGHT = 90;

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  headerSub: { fontSize: 12, fontWeight: "400", marginTop: 1 },
  savedBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 100,
  },
  savedBadge: { fontSize: 12, fontWeight: "700" },
  autoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 100,
  },
  autoBtnText: { fontSize: 13, fontWeight: "600" },
  scrollContent: { paddingTop: 18, gap: 0 },
  canvas: { paddingHorizontal: 18, gap: 10 },
  canvasLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 1.2, marginBottom: 4 },
  canvasRow: { flexDirection: "row", gap: 10, minHeight: SLOT_HEIGHT },
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
  slotLabel: { fontSize: 11, fontWeight: "600", textAlign: "center" },
  slotFilledContent: { flex: 1, padding: 10, justifyContent: "flex-end" },
  slotFilledName: { fontSize: 13, fontWeight: "700", lineHeight: 16 },
  slotFilledSub: { fontSize: 10, fontWeight: "500", marginTop: 2 },
  lockBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
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
  previewBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 4,
  },
  previewBtnText: { fontSize: 15, fontWeight: "700" },
  canvasActions: { flexDirection: "row", gap: 8, marginTop: 4 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
  },
  actionBtnText: { fontSize: 13, fontWeight: "600" },
  divider: { height: 1, marginHorizontal: 18, marginVertical: 20 },
  pickerSection: { paddingHorizontal: 18, gap: 14 },
  pickerTitle: { fontSize: 18, fontWeight: "700" },
  emptyWardrobe: {
    borderRadius: 16,
    padding: 28,
    alignItems: "center",
    gap: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: "600", marginTop: 4 },
  emptySubtitle: { fontSize: 13, textAlign: "center" },
  addBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 100,
    marginTop: 6,
  },
  addBtnText: { fontSize: 14, fontWeight: "600" },
  filterPills: { gap: 8, paddingRight: 18 },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 100,
  },
  filterPillText: { fontSize: 13, fontWeight: "600" },
  noItems: { fontSize: 14, textAlign: "center", paddingVertical: 24 },
  itemGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  draggableWrap: { width: "30%", alignItems: "center", gap: 6 },
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
  itemCardName: { fontSize: 11, fontWeight: "500", textAlign: "center", maxWidth: 80 },
  previewModal: { flex: 1 },
  previewModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  previewModalTitle: { fontSize: 17, fontWeight: "700" },
  previewHeaderActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  regenBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 100,
  },
  regenBtnText: { fontSize: 12, fontWeight: "600" },
  saveFromPreviewBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 100,
  },
  saveFromPreviewText: { fontSize: 13, fontWeight: "600" },
  previewModalContent: { padding: 18, gap: 16 },
  generatingContainer: {
    borderRadius: 20,
    padding: 48,
    alignItems: "center",
    gap: 12,
    minHeight: 300,
    justifyContent: "center",
  },
  generatingText: { fontSize: 17, fontWeight: "600", marginTop: 8 },
  generatingSubText: { fontSize: 13, textAlign: "center" },
  previewImage: {
    width: "100%",
    aspectRatio: 2 / 3,
    borderRadius: 20,
  },
  previewPieces: { gap: 8 },
  previewPiecesLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  previewPieceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  previewPieceColor: { width: 36, height: 36, borderRadius: 8, flexShrink: 0 },
  previewPieceName: { fontSize: 14, fontWeight: "600" },
  previewPieceCat: { fontSize: 12, fontWeight: "400", marginTop: 1 },
  saveModalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  saveModalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    padding: 24,
    gap: 14,
  },
  saveModalTitle: { fontSize: 18, fontWeight: "700" },
  saveModalSubtitle: { fontSize: 14, lineHeight: 20 },
  saveModalInput: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
  },
  saveModalActions: { flexDirection: "row", gap: 10 },
  saveModalCancel: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  saveModalCancelText: { fontSize: 15, fontWeight: "600" },
  saveModalConfirm: {
    flex: 1.5,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
  },
  saveModalConfirmText: { fontSize: 15, fontWeight: "600" },
  savedOutfitsModal: { flex: 1 },
  savedOutfitsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  savedOutfitsTitle: { fontSize: 18, fontWeight: "700" },
  savedOutfitsList: { padding: 18, gap: 12 },
  savedOutfitsEmpty: {
    alignItems: "center",
    paddingVertical: 60,
    gap: 10,
  },
  savedOutfitCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  savedOutfitThumb: {
    width: 72,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  colorSwatches: { flexDirection: "row" },
  miniSwatch: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#FAF8F5",
  },
  savedOutfitInfo: { flex: 1, paddingVertical: 14 },
  savedOutfitName: { fontSize: 15, fontWeight: "600" },
  savedOutfitMeta: { fontSize: 12, marginTop: 2 },
});
