import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import { useWardrobe, type ClothingItem } from "@/contexts/WardrobeContext";
import { useWeather } from "@/contexts/WeatherContext";
import { useUserProfile } from "@/contexts/UserProfileContext";
import {
  SQUAD_FRIENDS,
  type PollOutfitData,
  useSquadVote,
} from "@/contexts/SquadVoteContext";

const SCREEN_W = Dimensions.get("window").width;
const CARD_H = 500;
const API_BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

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
  items: OutfitItem[];
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
          <Feather name="scissors" size={13} color="#C8906A" />
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
                    borderColor: isSelected ? "#C8906A" : colors.border,
                  },
                ]}
              >
                <View style={[squadStyles.friendAvatar, { backgroundColor: isSelected ? "#C8906A" : colors.secondary }]}>
                  <Text style={[squadStyles.friendAvatarText, { color: isSelected ? "#FAF8F5" : colors.mutedForeground }]}>
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
                      backgroundColor: isSelected ? "#C8906A" : "transparent",
                      borderColor: isSelected ? "#C8906A" : colors.border,
                    },
                  ]}
                >
                  {isSelected && <Feather name="check" size={12} color="#FAF8F5" />}
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
                backgroundColor: selected.size > 0 ? "#C8906A" : colors.secondary,
              },
            ]}
          >
            <Feather name="send" size={16} color={selected.size > 0 ? "#FAF8F5" : colors.mutedForeground} />
            <Text
              style={[
                squadStyles.sendBtnText,
                { color: selected.size > 0 ? "#FAF8F5" : colors.mutedForeground },
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
  userBodyPhotoBase64,
  userBodyPhotoMime,
  userGender,
  userAge,
}: {
  outfit: Outfit;
  wardrobeMap: Map<string, ClothingItem>;
  temperature: number;
  weatherDesc: string;
  cardWidth: number;
  userBodyPhotoBase64: string | null;
  userBodyPhotoMime: string;
  userGender?: string | null;
  userAge?: number | null;
}) {
  const colors = useColors();
  const { createPoll } = useSquadVote();
  const moodColor = MOOD_COLORS[outfit.mood] ?? colors.accent;
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genFailed, setGenFailed] = useState(false);
  const [showSquadModal, setShowSquadModal] = useState(false);
  const [pollSent, setPollSent] = useState(false);
  const generated = useRef(false);

  const resolvedItems = outfit.items
    .map((oi) => wardrobeMap.get(oi.itemId))
    .filter((i): i is ClothingItem => !!i);

  useEffect(() => {
    if (generated.current || resolvedItems.length === 0) return;
    generated.current = true;
    setIsGenerating(true);

    const itemsForApi = resolvedItems.map((i) => ({
      name: i.name,
      color: i.color,
      colorHex: i.colorHex,
      category: i.category,
      ...(i.brandLogo ? { brandLogo: i.brandLogo } : {}),
    }));

    fetch(`${API_BASE}/outfit-preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: itemsForApi,
        weather: weatherDesc,
        temperature,
        ...(userBodyPhotoBase64 ? { userBodyPhotoBase64, userBodyPhotoMime } : {}),
        ...(userGender ? { userGender } : {}),
        ...(userAge != null ? { userAge } : {}),
      }),
    })
      .then((r) => r.json())
      .then((data: { image?: string }) => {
        if (data.image) {
          setPreviewImage(`data:image/png;base64,${data.image}`);
        } else {
          setGenFailed(true);
        }
      })
      .catch(() => setGenFailed(true))
      .finally(() => setIsGenerating(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSendToSquad = async (friendNames: string[]) => {
    const pollItems: PollOutfitData["items"] = resolvedItems.map((i) => ({
      name: i.name,
      color: i.color,
      category: i.category,
    }));
    const pollData: PollOutfitData = {
      name: outfit.name,
      mood: outfit.mood,
      previewImage: previewImage ?? undefined,
      items: pollItems,
    };
    await createPoll(pollData, friendNames);
    setShowSquadModal(false);
    setPollSent(true);
  };

  const imageAreaH = CARD_H - 72;

  return (
    <View
      style={[
        styles.card,
        { width: cardWidth, backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      {/* Image / loading area */}
      <View style={[styles.imageArea, { height: imageAreaH, backgroundColor: colors.secondary }]}>
        {previewImage ? (
          <Image
            source={{ uri: previewImage }}
            style={StyleSheet.absoluteFillObject}
            contentFit="contain"
            transition={400}
          />
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
                ? "Add items to your wardrobe\nto see a styled look"
                : "Preview unavailable"}
            </Text>
          </View>
        ) : null}

        <View style={[styles.moodPill, { backgroundColor: moodColor }]}>
          <Text style={styles.moodText}>{outfit.mood.toUpperCase()}</Text>
        </View>

        {previewImage && (
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
            <Feather name="check" size={14} color="#C8906A" />
          ) : (
            <Feather name="users" size={14} color="#C8906A" />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push("/outfit-builder")}
          style={[styles.buildBtn, { backgroundColor: colors.primary }]}
        >
          <Feather name="scissors" size={13} color={colors.primaryForeground} />
          <Text style={[styles.buildBtnText, { color: colors.primaryForeground }]}>
            Build look
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
  const { items } = useWardrobe();
  const { temperature, weatherCode, isLoading: weatherLoading } = useWeather();
  const { bodyPhotoBase64, bodyPhotoMime, gender, age, styleAesthetics, heatAdaptation, colorPalette } = useUserProfile();
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const cardWidth = SCREEN_W - 36;
  const wDesc = weatherDescLabel(temperature, weatherCode);

  const fetchOutfits = useCallback(async () => {
    if (weatherLoading) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/suggest-outfits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          temperature,
          weatherCode,
          ...(gender ? { userGender: gender } : {}),
          ...(age != null ? { userAge: age } : {}),
          ...(styleAesthetics.length > 0 ? { styleAesthetics } : {}),
          ...(heatAdaptation ? { heatAdaptation } : {}),
          ...(colorPalette ? { colorPalette } : {}),
        }),
      });
      const data = (await res.json()) as { outfits: Outfit[] };
      setOutfits(data.outfits ?? []);
    } catch {
      setOutfits([]);
    } finally {
      setLoading(false);
    }
  }, [items.length, temperature, weatherCode, weatherLoading]);

  useEffect(() => {
    if (!weatherLoading) void fetchOutfits();
  }, [weatherLoading, fetchOutfits]);

  const wardrobeMap = new Map(items.map((i) => [i.id, i]));

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / cardWidth);
    setActiveIdx(idx);
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.sectionHeader}>
        <View>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
            TODAY'S LOOKS
          </Text>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Outfit Ideas</Text>
        </View>
        <TouchableOpacity onPress={fetchOutfits} disabled={loading} style={styles.refreshBtn}>
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
            { backgroundColor: colors.card, borderColor: colors.border, height: CARD_H },
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
            { backgroundColor: colors.card, borderColor: colors.border, height: CARD_H },
          ]}
        >
          <Feather name="layers" size={28} color={colors.border} />
          <Text style={[styles.skeletonText, { color: colors.mutedForeground }]}>
            Add items to your wardrobe to get outfit ideas
          </Text>
          <TouchableOpacity
            onPress={() => router.push("/add-item")}
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
          >
            <Feather name="plus" size={14} color={colors.primaryForeground} />
            <Text style={[styles.addBtnText, { color: colors.primaryForeground }]}>
              Add first item
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onScroll}
            decelerationRate="fast"
            snapToInterval={cardWidth + 12}
            snapToAlignment="start"
            contentContainerStyle={{ gap: 12, paddingRight: 18 }}
          >
            {outfits.map((outfit, i) => (
              <OutfitCard
                key={`${outfit.name}-${outfit.mood}-${outfit.items.map((x) => x.itemId).join("-")}`}
                outfit={outfit}
                wardrobeMap={wardrobeMap}
                temperature={temperature}
                weatherDesc={wDesc}
                cardWidth={cardWidth}
                userBodyPhotoBase64={bodyPhotoBase64}
                userBodyPhotoMime={bodyPhotoMime}
                userGender={gender}
                userAge={age}
              />
            ))}
          </ScrollView>

          <View style={styles.dots}>
            {outfits.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i === activeIdx
                    ? { backgroundColor: colors.accent, width: 18 }
                    : { backgroundColor: colors.border, width: 6 },
                ]}
              />
            ))}
          </View>
        </>
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
    height: CARD_H,
  },
  imageArea: {
    overflow: "hidden",
    position: "relative",
  },
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
    color: "#FAF8F5",
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
