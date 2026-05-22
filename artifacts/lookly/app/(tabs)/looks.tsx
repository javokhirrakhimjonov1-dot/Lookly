import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LookCard from "@/components/LookCard";
import SquadVoteCard from "@/components/SquadVoteCard";
import { useColors } from "@/hooks/useColors";
import { useSocial } from "@/contexts/SocialContext";
import { useSquadVote } from "@/contexts/SquadVoteContext";
import { useWeather } from "@/contexts/WeatherContext";
import { useLanguage } from "@/contexts/LanguageContext";

export default function LooksScreen() {
  const colors = useColors();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { looks, addLook, toggleLike, removeLook } = useSocial();
  const { pendingPolls } = useSquadVote();
  const { condition, temperature } = useWeather();
  const [showPost, setShowPost] = useState(false);
  const [caption, setCaption] = useState("");
  const [tagInput, setTagInput] = useState("");

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const handlePost = async () => {
    if (!caption.trim()) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const tags = tagInput
      .split(",")
      .map((t) => t.trim().replace(/^#/, "").toLowerCase())
      .filter(Boolean);
    await addLook({
      userId: "me",
      userName: "You",
      userHandle: "my.lookly",
      caption: caption.trim(),
      weather: condition,
      temperature,
      tags: tags.length > 0 ? tags : ["ootd"],
    });
    setCaption("");
    setTagInput("");
    setShowPost(false);
  };

  const handleDelete = (id: string) => {
    Alert.alert(t("remove_look"), t("remove_confirm"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("remove"),
        style: "destructive",
        onPress: () => removeLook(id),
      },
    ]);
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
        <Text style={[styles.title, { color: colors.foreground }]}>{t("daily_looks_title")}</Text>
        <TouchableOpacity
          onPress={() => setShowPost(true)}
          style={[styles.postBtn, { backgroundColor: colors.primary }]}
        >
          <Feather name="camera" size={16} color={colors.primaryForeground} />
          <Text style={[styles.postBtnText, { color: colors.primaryForeground }]}>
            {t("post_look_btn")}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Platform.OS === "web" ? 100 : insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Pending Squad Votes ── */}
        {pendingPolls.length > 0 && (
          <View style={styles.votesSection}>
            <View style={styles.votesSectionHeader}>
              <View style={[styles.votesBadge, { backgroundColor: "#C8906A" }]}>
                <Feather name="users" size={11} color="#FAF8F5" />
                <Text style={styles.votesBadgeText}>{t("squad_vote_badge")}</Text>
              </View>
              <Text style={[styles.votesSectionCount, { color: colors.mutedForeground }]}>
                {pendingPolls.length} {t("pending")}
              </Text>
            </View>
            <Text style={[styles.votesSectionSub, { color: colors.mutedForeground }]}>
              {t("friends_opinion")}
            </Text>
            {pendingPolls.map((poll) => (
              <SquadVoteCard key={poll.id} poll={poll} />
            ))}
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
          </View>
        )}

        {/* ── Social Feed ── */}
        {looks.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="camera" size={40} color={colors.border} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              {t("no_looks")}
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
              {t("be_first")}
            </Text>
          </View>
        ) : (
          looks.map((look) => (
            <LookCard
              key={look.id}
              look={look}
              onLike={() => toggleLike(look.id)}
              onDelete={look.isOwn ? () => handleDelete(look.id) : undefined}
            />
          ))
        )}
      </ScrollView>

      {/* ── Post modal ── */}
      <Modal visible={showPost} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <View
            style={[
              styles.modalHeader,
              { borderBottomColor: colors.border, paddingTop: Platform.OS === "web" ? 30 : 20 },
            ]}
          >
            <TouchableOpacity onPress={() => setShowPost(false)}>
              <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>{t("cancel")}</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>{t("new_look")}</Text>
            <TouchableOpacity
              onPress={handlePost}
              style={[
                styles.shareBtn,
                { backgroundColor: caption.trim() ? colors.primary : colors.secondary },
              ]}
            >
              <Text
                style={[
                  styles.shareBtnText,
                  {
                    color: caption.trim()
                      ? colors.primaryForeground
                      : colors.mutedForeground,
                  },
                ]}
              >
                {t("share")}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.modalContent}>
            <View style={[styles.photoArea, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <Feather name="camera" size={36} color={colors.border} />
              <Text style={[styles.photoHint, { color: colors.mutedForeground }]}>
                {t("tap_add_photo")}
              </Text>
              <Text style={[styles.photoNote, { color: colors.mutedForeground }]}>
                {t("photo_coming_soon")}
              </Text>
            </View>

            <View style={[styles.weatherChip, { backgroundColor: colors.secondary }]}>
              <Feather name="cloud" size={13} color={colors.mutedForeground} />
              <Text style={[styles.weatherChipText, { color: colors.mutedForeground }]}>
                {condition} · {temperature}°C in Tashkent
              </Text>
            </View>

            <TextInput
              value={caption}
              onChangeText={setCaption}
              placeholder={t("describe_look")}
              placeholderTextColor={colors.mutedForeground}
              multiline
              maxLength={200}
              style={[
                styles.captionInput,
                {
                  color: colors.foreground,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                },
              ]}
            />

            <View
              style={[styles.tagInputWrap, { borderColor: colors.border, backgroundColor: colors.card }]}
            >
              <Feather name="hash" size={14} color={colors.mutedForeground} />
              <TextInput
                value={tagInput}
                onChangeText={setTagInput}
                placeholder={t("tags_placeholder")}
                placeholderTextColor={colors.mutedForeground}
                style={[styles.tagInput, { color: colors.foreground }]}
              />
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  title: { fontSize: 26, fontWeight: "700" },
  postBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 100,
  },
  postBtnText: { fontSize: 14, fontWeight: "600" },
  content: {
    paddingHorizontal: 18,
    paddingTop: 16,
  },
  votesSection: {
    marginBottom: 4,
  },
  votesSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  votesBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  votesBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#FAF8F5",
    letterSpacing: 0.8,
  },
  votesSectionCount: {
    fontSize: 12,
    fontWeight: "500",
  },
  votesSectionSub: {
    fontSize: 12,
    fontWeight: "400",
    marginBottom: 12,
    lineHeight: 17,
  },
  divider: {
    height: 1,
    marginBottom: 16,
    marginTop: 4,
  },
  empty: {
    alignItems: "center",
    paddingVertical: 60,
    gap: 10,
  },
  emptyTitle: { fontSize: 18, fontWeight: "600", marginTop: 8 },
  emptySubtitle: { fontSize: 14, textAlign: "center" },
  modal: { flex: 1 },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  cancelText: { fontSize: 15, fontWeight: "500" },
  modalTitle: { fontSize: 17, fontWeight: "700" },
  shareBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 100,
  },
  shareBtnText: { fontSize: 14, fontWeight: "600" },
  modalContent: { padding: 18, gap: 14 },
  photoArea: {
    height: 200,
    borderRadius: 18,
    borderWidth: 2,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  photoHint: { fontSize: 15, fontWeight: "500" },
  photoNote: { fontSize: 12 },
  weatherChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  weatherChipText: { fontSize: 13, fontWeight: "500" },
  captionInput: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    minHeight: 100,
    textAlignVertical: "top",
  },
  tagInputWrap: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  tagInput: { flex: 1, fontSize: 14 },
});
