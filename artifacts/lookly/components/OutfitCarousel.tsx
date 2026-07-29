import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { SvgXml } from "react-native-svg";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { getApiBase } from "@/constants/api";
import { apiAuthHeaders } from "@/lib/apiAuth";
import { useColors } from "@/hooks/useColors";
import { useWardrobe, type ClothingItem } from "@/contexts/WardrobeContext";
import { useWeather } from "@/contexts/WeatherContext";
import { useUserProfile } from "@/contexts/UserProfileContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  SQUAD_FRIENDS,
  type PollOutfitData,
  useSquadVote,
} from "@/contexts/SquadVoteContext";

// cardWidth and cardH are computed dynamically via useWindowDimensions inside each component
const API_BASE = getApiBase();

function decodeSvgPreview(dataUri: string): string {
  try {
    return globalThis.atob(dataUri.includes(",") ? dataUri.split(",")[1] : dataUri);
  } catch {
    return "";
  }
}

function isSvgPreview(value: string): boolean {
  return value.startsWith("data:image/svg+xml") || value.trimStart().startsWith("PHN2Zy");
}

function previewSource(value: string): string {
  return value.startsWith("data:") ? value : "data:image/png;base64," + value;
}

const MOOD_COLORS: Record<string, string> = {
  casual: "#C8906A",
  minimal: "#78716C",
  streetwear: "#1C1512",
  formal: "#1E3A5F",
  sporty: "#6B7C4D",
  boho: "#C19A6B",
  chic: "#800020",
};

interface OutfitItem {
  itemId: string;
  role: string;
}

interface Outfit {
  name: string;
  mood: string;
  weatherNote?: string | null;
  isComplete?: boolean;
  items: OutfitItem[];
}

type ImageReference = { imageBase64: string; imageMime: string };

async function imageUriToReference(uri?: string): Promise<ImageReference | null> {
  if (!uri) return null;
  if (uri.startsWith("data:")) {
    const [header, imageBase64 = ""] = uri.split(",", 2);
    const imageMime = header.match(/^data:([^;]+)/)?.[1] ?? "image/png";
    return imageBase64 ? { imageBase64, imageMime } : null;
  }
  try {
    const response = await fetch(uri);
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = "";
    for (let index = 0; index < bytes.length; index += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    }
    return {
      imageBase64: globalThis.btoa(binary),
      imageMime: response.headers.get("content-type")?.split(";")[0] || "image/png",
    };
  } catch {
    return null;
  }
}

async function generateTodayPreview(
  items: ClothingItem[], weather: string, temperature: number,
  bodyPhotoBase64: string | null, bodyPhotoMime: string,
  gender: string | null, age: number | null, mood: string,
): Promise<string> {
  const itemImages = (await Promise.all(items.map((item) => imageUriToReference(item.imageUri))))
    .filter((image): image is ImageReference => !!image);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 80_000);
  try {
    const response = await fetch(`${API_BASE}/outfit-preview`, {
      method: "POST",
      headers: await apiAuthHeaders(),
      signal: controller.signal,
      body: JSON.stringify({
        items: items.map((item) => ({ name: item.name, color: item.color, colorHex: item.colorHex, category: item.category })),
        weather, temperature, mood,
        userBodyPhotoBase64: bodyPhotoBase64 ?? undefined,
        userBodyPhotoMime: bodyPhotoBase64 ? bodyPhotoMime : undefined,
        userGender: gender ?? undefined, userAge: age ?? undefined, itemImages,
      }),
    });
    if (!response.ok) throw new Error(`Preview unavailable (${response.status})`);
    const data = await response.json() as { image?: string; mimeType?: string };
    if (!data.image) throw new Error("Preview response contained no image");
    return `data:${data.mimeType || "image/png"};base64,${data.image}`;
  } finally {
    clearTimeout(timeout);
  }
}

interface SquadModalProps {
  visible: boolean;
  outfitName: string;
  onClose: () => void;
  onSend: (friendNames: string[]) => void;
}

function SquadModal({ visible, outfitName, onClose, onSend }: SquadModalProps) {
  const colors = useColors();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleSend = () => {
    if (selected.size === 0) return;
    onSend(Array.from(selected));
    setSelected(new Set());
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[squadStyles.root, { backgroundColor: colors.background }]}>
        <View style={[squadStyles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={[squadStyles.cancel, { color: colors.mutedForeground }]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[squadStyles.title, { color: colors.foreground }]}>Ask Your Squad</Text>
          <View style={{ width: 52 }} />
        </View>

        <View style={[squadStyles.outfitChip, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <Feather name="scissors" size={13} color={colors.accent} />
          <Text style={[squadStyles.outfitChipText, { color: colors.foreground }]} numberOfLines={1}>
            {outfitName}
          </Text>
        </View>

        <Text style={[squadStyles.subtitle, { color: colors.mutedForeground }]}>
          Select friends to vote on this outfit
        </Text>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={squadStyles.friendList}>
          {SQUAD_FRIENDS.map((friend) => {
            const isSelected = selected.has(friend.name);
            return (
              <Pressable
                key={friend.id}
                onPress={() => toggle(friend.name)}
                style={[
                  squadStyles.friendRow,
                  {
                    backgroundColor: isSelected ? "#C8906A14" : colors.card,
                    borderColor: isSelected ? colors.accent : colors.border,
                  },
                ]}
              >
                <View style={[squadStyles.friendAvatar, { backgroundColor: isSelected ? colors.accent : colors.secondary }]}>
                  <Text style={[squadStyles.friendAvatarText, { color: isSelected ? colors.primaryForeground : colors.mutedForeground }]}>
                    {friend.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[squadStyles.friendName, { color: colors.foreground }]}>{friend.name}</Text>
                  <Text style={[squadStyles.friendHandle, { color: colors.mutedForeground }]}>@{friend.handle}</Text>
                </View>
                <View
                  style={[
                    squadStyles.checkbox,
                    {
                      backgroundColor: isSelected ? colors.accent : "transparent",
borderColor: isSelected ? colors.accent : colors.border,
                    },
                  ]}
                >
                  {isSelected && <Feather name="check" size={12} color={colors.primaryForeground} />}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={[squadStyles.footer, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
          <TouchableOpacity
            onPress={handleSend}
            disabled={selected.size === 0}
            style={[
              squadStyles.sendBtn,
              {
                backgroundColor: selected.size > 0 ? colors.accent : colors.secondary,
              },
            ]}
          >
            <Feather name="send" size={16} color={selected.size > 0 ? colors.primaryForeground : colors.mutedForeground} />
            <Text
              style={[
                squadStyles.sendBtnText,
                { color: selected.size > 0 ? colors.primaryForeground : colors.mutedForeground },
              ]}
            >
              {selected.size > 0
                ? `Send to Squad (${selected.size})`
                : "Select friends first"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function OutfitCard({
  outfit,
  wardrobeMap,
  temperature,
  weatherDesc,
  cardWidth,
  cardH,
}: {
  outfit: Outfit;
  wardrobeMap: Map<string, ClothingItem>;
  temperature: number;
  weatherDesc: string;
  cardWidth: number;
  cardH: number;
}) {
  const colors = useColors();
  const { t } = useLanguage();
  const { createPoll } = useSquadVote();
  const moodColor = MOOD_COLORS[outfit.mood] ?? colors.accent;
  const { bodyPhotoBase64, bodyPhotoMime, gender, age } = useUserProfile();
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genFailed, setGenFailed] = useState(false);
  const [showSquadModal, setShowSquadModal] = useState(false);
  const [pollSent, setPollSent] = useState(false);

  const resolvedItems = outfit.items
    .map((oi) => wardrobeMap.get(oi.itemId))
    .filter((i): i is ClothingItem => !!i);
  const itemImages = resolvedItems.filter((item) => !!item.imageUri).slice(0, 3);
  const canGeneratePreview = outfit.isComplete !== false && resolvedItems.length >= 2;
  // Do not reveal a partly-updated image while generation is still running. On
  // slower phones this used to flash a cropped torso behind the loading label.
  const hasReadyPreview = !!previewImage && !isGenerating;

  const handleCreatePreview = () => {
    if (!canGeneratePreview || isGenerating) return;
    setIsGenerating(true);
    setGenFailed(false);
    void generateTodayPreview(resolvedItems, weatherDesc, temperature, bodyPhotoBase64, bodyPhotoMime, gender, age, outfit.mood)
      .then(setPreviewImage)
      .catch(() => setGenFailed(true))
      .finally(() => setIsGenerating(false));
  };

  const handleSendToSquad = async (friendNames: string[]) => {
    const pollItems: PollOutfitData["items"] = resolvedItems.map((i) => ({
      name: i.name,
      color: i.color,
      category: i.category,
    }));
    const pollData: PollOutfitData = {
      name: outfit.name,
      mood: outfit.mood,
      items: pollItems,
    };
    await createPoll(pollData, friendNames);
    setShowSquadModal(false);
    setPollSent(true);
  };

  const imageAreaH = cardH - 72;

  return (
    <View
      style={[
        styles.card,
        { width: cardWidth, height: cardH, backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      {/* Image / loading area */}
      <View style={[styles.imageArea, { height: imageAreaH, backgroundColor: colors.secondary }]}>
        {itemImages.length > 0 ? (
          <View style={styles.instantFallback}>
            <Feather name="user" size={34} color={colors.border} />
            <Text style={[styles.generatingText, { color: colors.mutedForeground }]}>
              {canGeneratePreview ? "Your weather-ready look is ready" : "A complete weather-safe look needs more items"}
            </Text>
            <Text style={[styles.categoryLine, { color: colors.mutedForeground, display: "none" }]} numberOfLines={2}>
              {resolvedItems.map((item) => item.name).join(" · ")}
            </Text>
          </View>
        ) : (
          <View style={styles.instantFallback}>
            <Feather name="layers" size={32} color={colors.border} />
            <Text style={[styles.generatingText, { color: colors.mutedForeground }]}>{t("ob_outfit_pieces")}</Text>
            <Text style={[styles.categoryLine, { color: colors.mutedForeground, display: "none" }]} numberOfLines={2}>
              {resolvedItems.map((item) => item.name).join(" · ")}
            </Text>
          </View>
        )}
        {hasReadyPreview ? (
          isSvgPreview(previewImage) ? (
            <SvgXml xml={decodeSvgPreview(previewImage)} width="100%" height="100%" />
          ) : (
            <Image source={{ uri: previewSource(previewImage) }} style={styles.previewRaster} contentFit="contain" />
          )
        ) : isGenerating ? (
          <View style={styles.generatingOverlay}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={[styles.generatingText, { color: colors.mutedForeground }]}>
              Styling your look…
            </Text>
          </View>
        ) : genFailed || resolvedItems.length === 0 ? (
          <View style={styles.generatingOverlay}>
            <Feather name="image" size={32} color={colors.border} />
            <Text style={[styles.generatingText, { color: colors.mutedForeground }]}>
              {resolvedItems.length === 0
                ? t("ob_add_clothes_first")
                : t("preview_unavailable")}
            </Text>
          </View>
        ) : null}

        <View style={[styles.moodPill, { backgroundColor: moodColor }]}>
          <Text style={[styles.moodText, { color: colors.primaryForeground }]}>{outfit.mood.toUpperCase()}</Text>
        </View>

        {hasReadyPreview && (
          <View style={styles.imageScrim} pointerEvents="none" />
        )}
      </View>

      {/* Card footer */}
      <View style={styles.cardBody}>
        <View style={styles.cardInfo}>
          <Text style={[styles.outfitName, { color: colors.foreground }]} numberOfLines={1}>
            {outfit.name}
          </Text>
          <Text style={[styles.weatherNote, { color: colors.mutedForeground }]} numberOfLines={1}>
            {outfit.weatherNote ?? `${temperature}°C · ${weatherDesc}`}
          </Text>
        </View>

        {/* Ask Squad button */}
        <TouchableOpacity
          onPress={() => !pollSent && setShowSquadModal(true)}
          style={[
            styles.squadBtn,
            { backgroundColor: pollSent ? colors.secondary : "#C8906A18" },
          ]}
        >
          {pollSent ? (
            <Feather name="check" size={14} color={colors.accent} />
          ) : (
            <Feather name="users" size={14} color={colors.accent} />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            if (hasReadyPreview) {
              router.push({
                pathname: "/outfit-builder",
                params: {
                  outfitItemIds: resolvedItems.map((item) => item.id).join(","),
                  preview: "true",
                },
              });
              return;
            }
            handleCreatePreview();
          }}
          disabled={isGenerating || (!hasReadyPreview && !canGeneratePreview)}
          style={[styles.buildBtn, { backgroundColor: colors.primary }]}
        >
          {isGenerating ? <ActivityIndicator size="small" color={colors.primaryForeground} /> : <Feather name="scissors" size={13} color={colors.primaryForeground} />}
          <Text style={[styles.buildBtnText, { color: colors.primaryForeground }]}>
            {isGenerating ? "Styling…" : hasReadyPreview ? t("build_look") : "Make today’s look"}
          </Text>
        </TouchableOpacity>
      </View>

      <SquadModal
        visible={showSquadModal}
        outfitName={outfit.name}
        onClose={() => setShowSquadModal(false)}
        onSend={handleSendToSquad}
      />
    </View>
  );
}

export default function OutfitCarousel() {
  const colors = useColors();
  const { t } = useLanguage();
  const { items } = useWardrobe();
  const { temperature, weatherCode, humidity, windSpeed, rainProbability, uvIndex, isLoading: weatherLoading } = useWeather();
  const { gender, age, styleAesthetics, heatAdaptation, colorPalette } = useUserProfile();
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [loading, setLoading] = useState(false);
  const nextOptionIndex = useRef(0);

  const { width: screenW, height: screenH } = useWindowDimensions();
  const cardWidth = screenW - 36;
  const cardH = Math.min(Math.round(screenH * 0.58), 560);
  const wDesc = weatherDescLabel(temperature, weatherCode);

  const fetchOutfits = useCallback(async (showAnother = false) => {
    if (weatherLoading) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/suggest-outfits`, {
        method: "POST",
        headers: await apiAuthHeaders(),
        body: JSON.stringify({
          items,
          temperature,
          weatherCode,
          humidity,
          windSpeed,
          windUnit: "km/h",
          rainProbability,
          uvIndex,
          ...(gender ? { userGender: gender } : {}),
          ...(age != null ? { userAge: age } : {}),
          ...(styleAesthetics.length > 0 ? { styleAesthetics } : {}),
          ...(heatAdaptation ? { heatAdaptation } : {}),
          ...(colorPalette ? { colorPalette } : {}),
        }),
      });
      const data = (await res.json()) as { outfits: Outfit[] };
      const choices = data.outfits ?? [];
      if (choices.length === 0) {
        setOutfits([]);
      } else {
        if (!showAnother) nextOptionIndex.current = 0;
        const selected = choices[nextOptionIndex.current % choices.length]!;
        nextOptionIndex.current += 1;
        // Home should answer one simple question: what should I wear today?
        // Refresh is the explicit request for a different weather-safe option.
        setOutfits([selected]);
      }
    } catch {
      setOutfits([]);
    } finally {
      setLoading(false);
    }
  // Re-run when an item is edited, not only when the number of items changes.
  // Profile preferences also affect the request sent to the suggestion service.
  }, [
    items,
    temperature,
    weatherCode,
    humidity,
    windSpeed,
    rainProbability,
    uvIndex,
    weatherLoading,
    gender,
    age,
    styleAesthetics,
    heatAdaptation,
    colorPalette,
  ]);

  useEffect(() => {
    if (!weatherLoading) void fetchOutfits();
  }, [weatherLoading, fetchOutfits]);

  const wardrobeMap = new Map(items.map((i) => [i.id, i]));

  return (
    <View style={styles.wrapper}>
      <View style={styles.sectionHeader}>
        <View>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
            {t("today_looks")}
          </Text>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t("outfit_ideas")}</Text>
        </View>
        <TouchableOpacity onPress={() => void fetchOutfits(true)} disabled={loading} style={styles.refreshBtn}>
          {loading ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <Feather name="refresh-cw" size={15} color={colors.accent} />
          )}
        </TouchableOpacity>
      </View>

      {loading && outfits.length === 0 ? (
        <View
          style={[
            styles.skeleton,
            { backgroundColor: colors.card, borderColor: colors.border, height: cardH },
          ]}
        >
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.skeletonText, { color: colors.mutedForeground }]}>
            Styling your looks…
          </Text>
        </View>
      ) : outfits.length === 0 ? (
        <View
          style={[
            styles.skeleton,
            { backgroundColor: colors.card, borderColor: colors.border, height: cardH },
          ]}
        >
          <Feather name="layers" size={28} color={colors.border} />
          <Text style={[styles.skeletonText, { color: colors.mutedForeground }]}>
            {t("ob_add_clothes_first")}
          </Text>
          <TouchableOpacity
            onPress={() => router.push("/add-item")}
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
          >
            <Feather name="plus" size={14} color={colors.primaryForeground} />
            <Text style={[styles.addBtnText, { color: colors.primaryForeground }]}>
              {t("tap_add_first")}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View>
            {outfits.map((outfit, i) => (
              <OutfitCard
                key={`${outfit.name}-${outfit.mood}-${outfit.items.map((x) => x.itemId).join("-")}`}
                outfit={outfit}
                wardrobeMap={wardrobeMap}
                temperature={temperature}
                weatherDesc={wDesc}
                cardWidth={cardWidth}
                cardH={cardH}
              />
            ))}
        </View>
      )}
    </View>
  );
}

function weatherDescLabel(temp: number, code: number): string {
  if (code >= 71 && code <= 77) return "snowy";
  if (code >= 61 && code <= 67) return "rainy";
  if (code >= 51 && code <= 57) return "drizzly";
  if (code === 0) return "sunny";
  if (code <= 1) return "clear";
  return temp > 28 ? "hot & sunny" : temp > 20 ? "warm" : temp > 12 ? "mild" : "cool";
}

const styles = StyleSheet.create({
  wrapper: { gap: 12 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  sectionTitle: { fontSize: 20, fontWeight: "700" },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  skeleton: {
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
  },
  skeletonText: {
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 20,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 12,
    marginTop: 4,
  },
  addBtnText: { fontSize: 14, fontWeight: "600" },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
  },
  imageArea: {
    overflow: "hidden",
    position: "relative",
  },
  collage: {
    flex: 1,
    flexDirection: "row",
    gap: 8,
    padding: 16,
    alignItems: "center",
  },
  collageTile: {
    flex: 1,
    height: "90%",
    borderRadius: 16,
    overflow: "hidden",
    padding: 8,
  },
  outfitItemImage: { width: "100%", height: "100%" },
  instantFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 24,
  },
  categoryLine: {
    fontSize: 12,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 18,
  },
  previewRaster: { width: "100%", height: "100%" },
  generatingOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
  },
  generatingText: {
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 18,
  },
  imageScrim: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: "rgba(28,21,18,0.25)",
  },
  moodPill: {
    position: "absolute",
    top: 12,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    zIndex: 1,
  },
  moodText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
  },
  cardBody: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
    height: 72,
  },
  cardInfo: { flex: 1 },
  outfitName: { fontSize: 16, fontWeight: "700", marginBottom: 3 },
  weatherNote: { fontSize: 12, fontWeight: "400" },
  squadBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  buildBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    flexShrink: 0,
  },
  buildBtnText: { fontSize: 13, fontWeight: "600" },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 5,
  },
  dot: { height: 6, borderRadius: 3 },
});

const squadStyles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  cancel: { fontSize: 15, fontWeight: "500" },
  title: { fontSize: 17, fontWeight: "700" },
  outfitChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginHorizontal: 18,
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
  },
  outfitChipText: { fontSize: 14, fontWeight: "600", flex: 1 },
  subtitle: {
    fontSize: 13,
    fontWeight: "400",
    marginHorizontal: 18,
    marginTop: 10,
    marginBottom: 4,
  },
  friendList: { paddingHorizontal: 18, paddingTop: 8, gap: 8 },
  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  friendAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  friendAvatarText: { fontSize: 13, fontWeight: "700" },
  friendName: { fontSize: 14, fontWeight: "600", marginBottom: 1 },
  friendHandle: { fontSize: 11, fontWeight: "400" },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  footer: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderTopWidth: 1,
  },
  sendBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 15,
    borderRadius: 16,
  },
  sendBtnText: { fontSize: 15, fontWeight: "700" },
});
