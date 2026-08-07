import { Feather } from "@/components/FeatherIcon";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
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
import { getApiBase } from "@/constants/api";
import { apiAuthHeaders } from "@/lib/apiAuth";
import { useColors } from "@/hooks/useColors";
import { getItemDisplayName, type ClothingItem, useWardrobe } from "@/contexts/WardrobeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { translateGeneratedClothingName } from "@/lib/localization";
import { useWeather } from "@/contexts/WeatherContext";
import { useUserProfile } from "@/contexts/UserProfileContext";
import { getGarmentTone } from "@/lib/garmentTone";

function isLight(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}

const VIBE_COLORS: Record<string, string> = {
  "Perfect match": "#C8906A",
  "Bold contrast": "#800020",
  "Classic combo": "#1E3A5F",
  "Layer up": "#6B7C4D",
  "Color harmony": "#C19A6B",
  "Casual cool": "#8A8A8A",
};

const CATEGORY_ICONS: Record<string, React.ComponentProps<typeof Feather>["name"]> = {
  tops: "wind",
  bottoms: "minus",
  dresses: "star",
  outerwear: "layers",
  shoes: "chevrons-up",
  socks: "grid",
  accessories: "circle",
};

const API_BASE = getApiBase();

interface Suggestion {
  id: string;
  reason: string;
  vibe: string;
}

interface Props {
  item: ClothingItem | null;
  onClose: () => void;
  onDelete: (id: string) => void;
}

export default function ItemDetailSheet({ item, onClose, onDelete }: Props) {
  const colors = useColors();
  const itemTone = getGarmentTone(item?.colorHex, colors.border);
  const { lang, t } = useLanguage();
  const { items, updateItem } = useWardrobe();
  const { temperature, condition } = useWeather();
  const { age, gender, stylingPreferences } = useUserProfile();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [seenIds, setSeenIds] = useState<string[]>([]);
  const [suggestionMessage, setSuggestionMessage] = useState<string | null>(null);
  const [customName, setCustomName] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);
  const [coverageDraft, setCoverageDraft] = useState("");
  const [lengthDraft, setLengthDraft] = useState("");
  const [sleeveDraft, setSleeveDraft] = useState("");
  const [necklineDraft, setNecklineDraft] = useState("");
  const [opacityDraft, setOpacityDraft] = useState("");
  const [isSavingCoverage, setIsSavingCoverage] = useState(false);

  const suggestOpacity = useSharedValue(0);
  const suggestTranslate = useSharedValue(20);

  const suggestStyle = useAnimatedStyle(() => ({
    opacity: suggestOpacity.value,
    transform: [{ translateY: suggestTranslate.value }],
  }));

  useEffect(() => {
    if (!item) {
      setSuggestions([]);
      setHasFetched(false);
      setSeenIds([]);
      setSuggestionMessage(null);
      suggestOpacity.value = 0;
      suggestTranslate.value = 20;
    }
    setCustomName(item?.customName ?? "");
    setCoverageDraft(item?.visualSignature?.coverage ?? "");
    setLengthDraft(item?.visualSignature?.length ?? "");
    setSleeveDraft(item?.visualSignature?.sleeve ?? "");
    setNecklineDraft(item?.visualSignature?.neckline ?? "");
    setOpacityDraft(item?.visualSignature?.opacity ?? "");
  }, [item?.id]);

  const handleFindMatches = async (excludeIds?: string[]) => {
    if (!item) return;
    setIsLoading(true);
    suggestOpacity.value = 0;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await fetch(`${API_BASE}/pair-items`, {
        method: "POST",
        headers: await apiAuthHeaders(),
        body: JSON.stringify({
          selectedItem: item,
          wardrobe: items,
          excludeIds: excludeIds ?? [],
          weather: condition,
          temperature,
          userGender: gender ?? undefined,
          userAge: age ?? undefined,
          stylingPreferences,
        }),
      });
      const data = (await res.json()) as { suggestions: Suggestion[]; message?: string };
      const newSuggestions = data.suggestions ?? [];
      setSuggestionMessage(data.message ?? null);
      setSuggestions(newSuggestions);
      setSeenIds((prev) => [...prev, ...newSuggestions.map((s) => s.id)]);
      setHasFetched(true);
      suggestOpacity.value = withTiming(1, { duration: 400 });
      suggestTranslate.value = withSpring(0, { damping: 14 });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setHasFetched(true);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBuildLook = () => {
    onClose();
    setTimeout(() => router.push("/outfit-builder"), 300);
  };

  const handleStyleThisItem = () => {
    if (!item) return;
    onClose();
    setTimeout(() => router.push(`/outfit-builder?anchorItemId=${item.id}`), 300);
  };

  const handleSaveName = async () => {
    if (!item || isSavingName) return;
    const nextName = customName.trim();
    if (nextName === (item.customName ?? "")) return;
    setIsSavingName(true);
    try {
      await updateItem(item.id, { customName: nextName || undefined });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally {
      setIsSavingName(false);
    }
  };

  const handleSaveCoverage = async () => {
    if (!item || isSavingCoverage) return;
    setIsSavingCoverage(true);
    try {
      const current = item.visualSignature;
      await updateItem(item.id, {
        visualSignature: {
          itemType: current?.itemType ?? item.name.toLowerCase(),
          garmentFamily: current?.garmentFamily,
          shape: current?.shape ?? "regular",
          silhouette: current?.silhouette,
          length: lengthDraft.trim().toLowerCase(),
          pattern: current?.pattern ?? "solid",
          materialFamily: current?.materialFamily ?? "unknown",
          closures: current?.closures ?? [],
          sleeve: sleeveDraft.trim().toLowerCase(),
          collar: current?.collar ?? "not-applicable",
          neckline: necklineDraft.trim().toLowerCase(),
          rise: current?.rise,
          coverage: coverageDraft.trim().toLowerCase(),
          opacity: opacityDraft.trim().toLowerCase(),
          layerRole: current?.layerRole,
          toeStyle: current?.toeStyle,
          heelType: current?.heelType,
          heelHeight: current?.heelHeight,
          bootShaft: current?.bootShaft,
          features: current?.features ?? [],
        },
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally {
      setIsSavingCoverage(false);
    }
  };

  const resolvedItem = (id: string) => items.find((i) => i.id === id);

  if (!item) return null;

  return (
    <Modal
      visible={!!item}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.header,
            {
              borderBottomColor: colors.border,
              paddingTop: Platform.OS === "web" ? 20 : 20,
            },
          ]}
        >
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Feather name="x" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t("item_details")}</Text>
          <TouchableOpacity
            onPress={() => {
              onDelete(item.id);
              onClose();
            }}
            style={[styles.deleteBtn, { backgroundColor: colors.secondary }]}
          >
            <Feather name="trash-2" size={14} color={colors.destructive} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Platform.OS === "web" ? 60 : 60 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.itemHero, { backgroundColor: itemTone.background, borderColor: itemTone.border }]}>
            {item.imageUri ? (
              <Image
                source={{ uri: item.imageUri }}
                style={styles.itemImage}
                contentFit="contain"
              />
            ) : (
              <Feather
                name={CATEGORY_ICONS[item.category] ?? "circle"}
                size={56}
                color={isLight(item.colorHex) ? "rgba(28,21,18,0.4)" : "rgba(250,248,245,0.4)"}
              />
            )}
          </View>

          <View style={styles.itemInfo}>
            <Text style={[styles.itemName, { color: colors.foreground }]}>{item.customName ? getItemDisplayName(item, lang) : translateGeneratedClothingName(getItemDisplayName(item, lang), lang)}</Text>
            {item.customName ? (
              <Text style={[styles.aiDescription, { color: colors.mutedForeground }]}>
                AI: {translateGeneratedClothingName(item.localizedNames?.[lang] || item.name, lang)}
              </Text>
            ) : null}
            <Text style={[styles.itemMeta, { color: colors.mutedForeground }]}>
              {t(`cat_${item.category}`)} · {t(`color_${item.color.toLowerCase().replaceAll(" ", "_")}`)}
            </Text>
            <View style={styles.seasonsRow}>
              {item.seasons.map((s) => (
                <View
                  key={s}
                  style={[styles.seasonPill, { backgroundColor: colors.secondary }]}
                >
                  <Text style={[styles.seasonText, { color: colors.mutedForeground }]}>
                    {t(`season_${s}`)}
                  </Text>
                </View>
              ))}
            </View>
            {item.tags && item.tags.length > 0 && (
              <View style={styles.tagsRow}>
                {item.tags.map((t) => (
                  <View
                    key={t}
                    style={[
                      styles.tagPill,
                      { backgroundColor: colors.card, borderColor: colors.border },
                    ]}
                  >
                    <Text style={[styles.tagText, { color: colors.mutedForeground }]}>{t}</Text>
                  </View>
                ))}
              </View>
            )}
            <View style={styles.personalNameSection}>
              <Text style={[styles.personalNameLabel, { color: colors.foreground }]}>{t("personal_name_optional")}</Text>
              <View style={styles.personalNameRow}>
                <TextInput
                  value={customName}
                  onChangeText={setCustomName}
                  placeholder="e.g. My date-night shirt"
                  placeholderTextColor={colors.mutedForeground}
                  maxLength={60}
                  style={[styles.personalNameInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
                />
                <TouchableOpacity
                  onPress={() => void handleSaveName()}
                  disabled={isSavingName || customName.trim() === (item.customName ?? "")}
                  style={[styles.saveNameButton, { backgroundColor: colors.accent, opacity: isSavingName || customName.trim() === (item.customName ?? "") ? 0.5 : 1 }]}
                >
                  {isSavingName ? <ActivityIndicator size="small" color={colors.primaryForeground} /> : <Text style={[styles.saveNameText, { color: colors.primaryForeground }]}>{t("save")}</Text>}
                </TouchableOpacity>
              </View>
              {item.customName ? <Text style={[styles.personalNameHint, { color: colors.mutedForeground }]}>{t("restore_ai_name")}</Text> : null}
            </View>
            {["tops", "bottoms", "dresses", "outerwear"].includes(item.category) ? <View style={styles.coverageEditor}>
              <Text style={[styles.personalNameLabel, { color: colors.foreground }]}>Coverage details</Text>
              <Text style={[styles.personalNameHint, { color: colors.mutedForeground }]}>Verify these details so automatic suggestions can safely match your profile.</Text>
              <View style={styles.coverageGrid}>
                <TextInput value={coverageDraft} onChangeText={setCoverageDraft} placeholder="maximum, modest…" placeholderTextColor={colors.mutedForeground} style={[styles.coverageInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]} />
                <TextInput value={lengthDraft} onChangeText={setLengthDraft} placeholder="maxi, ankle…" placeholderTextColor={colors.mutedForeground} style={[styles.coverageInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]} />
                <TextInput value={sleeveDraft} onChangeText={setSleeveDraft} placeholder="long, 3/4…" placeholderTextColor={colors.mutedForeground} style={[styles.coverageInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]} />
                <TextInput value={necklineDraft} onChangeText={setNecklineDraft} placeholder="high, crew…" placeholderTextColor={colors.mutedForeground} style={[styles.coverageInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]} />
                <TextInput value={opacityDraft} onChangeText={setOpacityDraft} placeholder="opaque, sheer…" placeholderTextColor={colors.mutedForeground} style={[styles.coverageInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]} />
              </View>
              <TouchableOpacity onPress={() => void handleSaveCoverage()} disabled={isSavingCoverage} style={[styles.coverageSave, { backgroundColor: colors.accent, opacity: isSavingCoverage ? 0.5 : 1 }]}>{isSavingCoverage ? <ActivityIndicator size="small" color={colors.primaryForeground} /> : <Text style={[styles.saveNameText, { color: colors.primaryForeground }]}>Save coverage details</Text>}</TouchableOpacity>
            </View> : null}
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              onPress={handleStyleThisItem}
              style={[styles.actionBtn, { backgroundColor: colors.accent }]}
            >
              <Feather name="zap" size={15} color={colors.primaryForeground} />
              <Text style={[styles.actionBtnText, { color: colors.primaryForeground }]}>{t("style_this_item")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleFindMatches(hasFetched ? seenIds : [])}
              disabled={isLoading}
              style={[
                styles.actionBtn,
                styles.matchBtn,
                { backgroundColor: colors.secondary, borderColor: colors.border },
              ]}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <Feather
                  name={hasFetched ? "refresh-cw" : "scissors"}
                  size={15}
                  color={colors.accent}
                />
              )}
              <Text style={[styles.actionBtnText, { color: colors.accent }]}>
                {isLoading ? "Pairing…" : hasFetched ? "More pairings" : "Find pairings"}
              </Text>
            </TouchableOpacity>
          </View>

          {hasFetched && (
            <Animated.View style={[styles.suggestionsSection, suggestStyle]}>
              <Text style={[styles.suggestionsTitle, { color: colors.foreground }]}>
                {suggestions.length > 0
                  ? "Styled with pieces from your wardrobe"
                  : "No matching items found"}
              </Text>
              {suggestions.length === 0 && (
                <Text style={[styles.suggestionsEmpty, { color: colors.mutedForeground }]}>
                  {suggestionMessage ?? "Add more items to your wardrobe to get pairing suggestions."}
                </Text>
              )}
              {suggestions.map((s) => {
                const match = resolvedItem(s.id);
                if (!match) return null;
                const vibeColor = VIBE_COLORS[s.vibe] ?? colors.accent;
                const matchTone = getGarmentTone(match.colorHex, colors.border);
                return (
                  <View
                    key={s.id}
                    style={[
                      styles.suggestionCard,
                      { backgroundColor: matchTone.background, borderColor: matchTone.border },
                    ]}
                  >
                    <View
                      style={[
                        styles.suggestionColorBlock,
                        { backgroundColor: matchTone.background },
                      ]}
                    >
                      {match.imageUri ? (
                        <Image
                          source={{ uri: match.imageUri }}
                          style={StyleSheet.absoluteFillObject}
                          contentFit="contain"
                        />
                      ) : (
                        <Feather
                          name={CATEGORY_ICONS[match.category] ?? "circle"}
                          size={22}
                          color={
                            isLight(match.colorHex)
                              ? "rgba(28,21,18,0.5)"
                              : "rgba(250,248,245,0.5)"
                          }
                        />
                      )}
                    </View>
                    <View style={styles.suggestionInfo}>
                      <View style={styles.suggestionTop}>
                        <Text
                          style={[styles.suggestionName, { color: colors.foreground }]}
                          numberOfLines={1}
                        >
                          {match.name}
                        </Text>
                        <View
                          style={[
                            styles.vibePill,
                            { backgroundColor: vibeColor + "1A" },
                          ]}
                        >
                          <Text style={[styles.vibeText, { color: vibeColor }]}>
                            {s.vibe}
                          </Text>
                        </View>
                      </View>
                      <Text
                        style={[styles.suggestionMeta, { color: colors.mutedForeground }]}
                      >
                        {match.category.charAt(0).toUpperCase() + match.category.slice(1)} · {match.color}
                      </Text>
                      <Text
                        style={[styles.suggestionReason, { color: colors.mutedForeground }]}
                        numberOfLines={3}
                      >
                        {s.reason}
                      </Text>
                    </View>
                  </View>
                );
              })}

              {suggestions.length > 0 && (
                <TouchableOpacity
                  onPress={handleBuildLook}
                  style={[
                    styles.buildFromSuggestBtn,
                    { backgroundColor: colors.primary },
                  ]}
                >
                  <Feather name="scissors" size={15} color={colors.primaryForeground} />
                  <Text style={[styles.buildFromSuggestText, { color: colors.primaryForeground }]}>
                    Build look with these pieces
                  </Text>
                </TouchableOpacity>
              )}
            </Animated.View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontWeight: "700" },
  closeBtn: { width: 32, alignItems: "flex-start" },
  deleteBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  content: { gap: 20, paddingTop: 0 },
  itemHero: {
    width: "100%",
    // A phone can use a full-width square. On desktop, that same rule turns a
    // single item into a giant image, so keep it as a compact product stage.
    ...(Platform.OS === "web"
      ? { aspectRatio: 1, maxWidth: 520, alignSelf: "center" as const, borderRadius: 18 }
      : { aspectRatio: 1 }),
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  itemImage: {
    width: "100%",
    height: "100%",
  },
  itemInfo: {
    paddingHorizontal: 18,
    gap: 6,
  },
  itemName: { fontSize: 22, fontWeight: "700" },
  aiDescription: { fontSize: 13, lineHeight: 18 },
  itemMeta: { fontSize: 14 },
  personalNameSection: { gap: 6, marginTop: 10 },
  personalNameLabel: { fontSize: 13, fontWeight: "700" },
  personalNameRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  personalNameInput: { flex: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  saveNameButton: { minWidth: 64, minHeight: 42, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  saveNameText: { fontSize: 13, fontWeight: "700" },
  personalNameHint: { fontSize: 11, lineHeight: 15 },
  coverageEditor: { gap: 8, marginTop: 14 },
  coverageGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  coverageInput: { flexGrow: 1, flexBasis: "44%", borderWidth: 1, borderRadius: 12, paddingHorizontal: 11, paddingVertical: 9, fontSize: 13 },
  coverageSave: { minHeight: 42, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  seasonsRow: { flexDirection: "row", gap: 6, marginTop: 4 },
  seasonPill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  seasonText: { fontSize: 11, fontWeight: "600" },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  tagPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100, borderWidth: 1 },
  tagText: { fontSize: 11, fontWeight: "500" },
  actions: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 18,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
  },
  matchBtn: { flex: 1.4, borderWidth: 0 },
  actionBtnText: { fontSize: 14, fontWeight: "600" },
  suggestionsSection: {
    paddingHorizontal: 18,
    gap: 12,
  },
  suggestionsTitle: { fontSize: 17, fontWeight: "700" },
  suggestionsEmpty: { fontSize: 14, lineHeight: 20 },
  suggestionCard: {
    flexDirection: "row",
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  suggestionColorBlock: {
    width: 76,
    height: 76,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    position: "relative",
    overflow: "hidden",
  },
  suggestionInfo: {
    flex: 1,
    padding: 12,
    gap: 3,
  },
  suggestionTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  suggestionName: { fontSize: 14, fontWeight: "700", flex: 1 },
  vibePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
  },
  vibeText: { fontSize: 10, fontWeight: "700" },
  suggestionMeta: { fontSize: 11 },
  suggestionReason: { fontSize: 12, lineHeight: 17, marginTop: 3 },
  buildFromSuggestBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 4,
  },
  buildFromSuggestText: { fontSize: 14, fontWeight: "700" },
});
