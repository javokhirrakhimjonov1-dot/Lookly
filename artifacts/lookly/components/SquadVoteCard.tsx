import { Feather } from "@/components/FeatherIcon";
import { Image } from "expo-image";
import { SvgXml } from "react-native-svg";
import React, { useRef, useState } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import { getTimeLeft, Poll, useSquadVote } from "@/contexts/SquadVoteContext";

interface Props {
  poll: Poll;
}

function isSvgPreview(value: string): boolean {
  return value.startsWith("data:image/svg+xml") || value.trimStart().startsWith("PHN2Zy");
}

function previewSource(value: string): string {
  return value.startsWith("data:") ? value : `data:image/png;base64,${value}`;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function SquadVoteCard({ poll }: Props) {
  const colors = useColors();
  const { castVote, dismissPoll, myVotes } = useSquadVote();
  const existingVote = myVotes[poll.id] ?? null;
  const [voted, setVoted] = useState<"heart" | "dislike" | null>(existingVote);
  const barAnim = useRef(new Animated.Value(0)).current;

  const totalVotes = poll.votes.length + (voted ? 1 : 0);
  const heartCount =
    poll.votes.filter((v) => v.response === "heart").length +
    (voted === "heart" ? 1 : 0);
  const heartRatio = totalVotes > 0 ? heartCount / totalVotes : 0;

  React.useEffect(() => {
    if (voted) {
      Animated.spring(barAnim, {
        toValue: heartRatio,
        useNativeDriver: false,
        tension: 60,
        friction: 8,
      }).start();
    }
  }, [voted]);

  const handleVote = async (response: "heart" | "dislike") => {
    if (voted) return;
    setVoted(response);
    await castVote(poll.id, response);
    const newHearts =
      poll.votes.filter((v) => v.response === "heart").length +
      (response === "heart" ? 1 : 0);
    const newTotal = poll.votes.length + 1;
    Animated.spring(barAnim, {
      toValue: newTotal > 0 ? newHearts / newTotal : 0,
      useNativeDriver: false,
      tension: 60,
      friction: 8,
    }).start();
  };

  const timeLeft = getTimeLeft(poll.expiresAt);
  const initials = getInitials(poll.creatorName);
  const avatarColors = ["#C8906A", "#8B7355", "#6B7280"];
  const avatarBg =
    avatarColors[
      poll.creatorId
        .split("")
        .reduce((a, c) => a + c.charCodeAt(0), 0) % avatarColors.length
    ] ?? "#C8906A";

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.badge, { backgroundColor: colors.accent }]}>
            <Feather name="users" size={10} color={colors.primaryForeground} />
            <Text style={[styles.badgeText, { color: colors.primaryForeground }]}>SQUAD VOTE</Text>
          </View>
          <Text style={[styles.timeLeft, { color: colors.mutedForeground }]}>
            {timeLeft}
          </Text>
        </View>
        {voted && (
          <TouchableOpacity
            onPress={() => dismissPoll(poll.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="x" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>

      {/* Image area */}
      <View
        style={[
          styles.imageArea,
          { backgroundColor: colors.secondary },
        ]}
      >
        {poll.outfitData.previewImage ? (
          isSvgPreview(poll.outfitData.previewImage) ? (
            <SvgXml xml={decodeSvgPreview(poll.outfitData.previewImage)} width="100%" height="100%" />
          ) : (
            <Image source={{ uri: previewSource(poll.outfitData.previewImage) }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
          )
        ) : (
          <View style={styles.imagePlaceholder}>
            <Feather name="image" size={26} color={colors.border} />
            <View style={styles.itemPills}>
              {poll.outfitData.items.slice(0, 3).map((item, i) => (
                <View
                  key={i}
                  style={[styles.itemPill, { backgroundColor: colors.background, borderColor: colors.border }]}
                >
                  <Text style={[styles.itemPillText, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Mood pill */}
        <View style={[styles.moodPill, { backgroundColor: colors.accent }]}>
          <Text style={[styles.moodText, { color: colors.primaryForeground }]}>{poll.outfitData.mood.toUpperCase()}</Text>
        </View>
      </View>

      {/* Info row */}
      <View style={styles.info}>
        <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
          <Text style={[styles.avatarText, { color: colors.primaryForeground }]}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.outfitName, { color: colors.foreground }]} numberOfLines={1}>
            {poll.outfitData.name}
          </Text>
          <Text style={[styles.creatorLine, { color: colors.mutedForeground }]}>
            by {poll.creatorName} · {poll.votes.length} vote{poll.votes.length !== 1 ? "s" : ""}
          </Text>
        </View>
      </View>

      {/* Vote buttons OR result bar */}
      {voted ? (
        <View style={styles.resultSection}>
          <View style={styles.resultLabels}>
            <View style={styles.resultLabel}>
              <Feather name="heart" size={12} color={colors.accent} />
              <Text style={[styles.resultPct, { color: colors.accent }]}>
                {Math.round(heartRatio * 100)}%
              </Text>
            </View>
            <View style={styles.resultLabel}>
              <Text style={[styles.resultPct, { color: colors.mutedForeground }]}>
                {Math.round((1 - heartRatio) * 100)}%
              </Text>
              <Feather name="x-circle" size={12} color={colors.mutedForeground} />
            </View>
          </View>
          <View style={[styles.barTrack, { backgroundColor: colors.secondary }]}>
            <Animated.View
              style={[
                styles.barFill,
                {
backgroundColor: colors.accent,
                  width: barAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["0%", "100%"],
                  }),
                },
              ]}
            />
          </View>
          <Text style={[styles.votedNote, { color: colors.mutedForeground }]}>
            You voted {voted === "heart" ? "❤️ Love it" : "✕ Skip it"} · {totalVotes} total vote{totalVotes !== 1 ? "s" : ""}
          </Text>
        </View>
      ) : (
        <View style={styles.voteButtons}>
          <Pressable
            onPress={() => handleVote("heart")}
            style={({ pressed }) => [
              styles.voteBtn,
              styles.heartBtn,
              { backgroundColor: colors.accent, opacity: pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.96 : 1 }] },
            ]}
          >
            <Feather name="heart" size={18} color={colors.primaryForeground} />
            <Text style={[styles.voteBtnText, { color: colors.primaryForeground }]}>Love It</Text>
          </Pressable>
          <Pressable
            onPress={() => handleVote("dislike")}
            style={({ pressed }) => [
              styles.voteBtn,
              styles.skipBtn,
              {
                backgroundColor: colors.primary,
                opacity: pressed ? 0.8 : 1,
                transform: [{ scale: pressed ? 0.96 : 1 }],
              },
            ]}
          >
            <Feather name="x" size={18} color={colors.primaryForeground} />
            <Text style={[styles.voteBtnText, { color: colors.primaryForeground }]}>
              Skip It
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 12,
    shadowColor: "#1C1512",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  timeLeft: {
    fontSize: 11,
    fontWeight: "500",
  },
  imageArea: {
    aspectRatio: 16 / 9,
    position: "relative",
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 16,
  },
  itemPills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    justifyContent: "center",
  },
  itemPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  itemPillText: {
    fontSize: 11,
    fontWeight: "500",
  },
  moodPill: {
    position: "absolute",
    top: 10,
    right: 10,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 20,
  },
  moodText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  info: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarText: {
    fontSize: 12,
    fontWeight: "700",
  },
  outfitName: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 1,
  },
  creatorLine: {
    fontSize: 11,
    fontWeight: "400",
  },
  voteButtons: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  voteBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 13,
    borderRadius: 14,
  },
  heartBtn: {
  },
  skipBtn: {},
  voteBtnText: {
    fontSize: 14,
    fontWeight: "700",
  },
  resultSection: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 6,
  },
  resultLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  resultLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  resultPct: {
    fontSize: 13,
    fontWeight: "700",
  },
  barTrack: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 4,
  },
  votedNote: {
    fontSize: 11,
    fontWeight: "500",
    marginTop: 2,
  },
});
function decodeSvgPreview(dataUri: string): string {
  try {
    return globalThis.atob(dataUri.includes(",") ? dataUri.split(",")[1] : dataUri);
  } catch {
    return "";
  }
}
