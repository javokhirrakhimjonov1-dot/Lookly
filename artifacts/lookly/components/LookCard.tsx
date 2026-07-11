import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import { type Look } from "@/contexts/SocialContext";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const AVATAR_COLORS = ["#C8906A", "#8B7355", "#2D5BE3", "#6B21A8", "#CC0000"];

interface Props {
  look: Look;
  onLike: () => void;
  onDelete?: () => void;
}

export default function LookCard({ look, onLike, onDelete }: Props) {
  const colors = useColors();
  const scaleAnim = React.useRef(new Animated.Value(1)).current;
  const colorIndex =
    look.userId
      .split("")
      .reduce((acc, c) => acc + c.charCodeAt(0), 0) % AVATAR_COLORS.length;
  const avatarColor = AVATAR_COLORS[colorIndex];

  const handleLike = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.3, duration: 100, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
    onLike();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
          <Text style={[styles.initials, { color: colors.card }]}>{getInitials(look.userName)}</Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={[styles.userName, { color: colors.foreground }]}>{look.userName}</Text>
          <Text style={[styles.handle, { color: colors.mutedForeground }]}>
            @{look.userHandle} · {timeAgo(look.timestamp)}
          </Text>
        </View>
        {onDelete && (
          <TouchableOpacity
            onPress={onDelete}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="trash-2" size={15} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>

      {(look.weather || look.temperature) && (
        <View style={[styles.weatherTag, { backgroundColor: colors.secondary }]}>
          <Feather name="cloud" size={11} color={colors.mutedForeground} />
          <Text style={[styles.weatherText, { color: colors.mutedForeground }]}>
            {look.weather ?? ""}{look.temperature !== undefined ? ` · ${look.temperature}°C` : ""}
          </Text>
        </View>
      )}

      <View style={[styles.imagePlaceholder, { backgroundColor: colors.secondary }]}>
        <Feather name="camera" size={28} color={colors.border} />
        <Text style={[styles.placeholderText, { color: colors.mutedForeground }]}>Daily Look</Text>
      </View>

      <Text style={[styles.caption, { color: colors.foreground }]}>{look.caption}</Text>

      <View style={styles.tags}>
        {look.tags.map((tag) => (
          <View key={tag} style={[styles.tag, { backgroundColor: colors.secondary }]}>
            <Text style={[styles.tagText, { color: colors.mutedForeground }]}>#{tag}</Text>
          </View>
        ))}
      </View>

      <View style={[styles.actions, { borderTopColor: colors.border }]}>
        <Pressable onPress={handleLike} style={styles.action}>
          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <Feather
              name="heart"
              size={18}
              color={look.isLiked ? colors.destructive : colors.mutedForeground}
            />
          </Animated.View>
          <Text
            style={[
              styles.actionCount,
              { color: look.isLiked ? colors.destructive : colors.mutedForeground },
            ]}
          >
            {look.likes}
          </Text>
        </Pressable>
        <View style={styles.action}>
          <Feather name="message-circle" size={18} color={colors.mutedForeground} />
          <Text style={[styles.actionCount, { color: colors.mutedForeground }]}>
            {look.comments}
          </Text>
        </View>
        <TouchableOpacity style={styles.action}>
          <Feather name="share-2" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 14,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    paddingBottom: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  initials: {
    fontSize: 14,
    fontWeight: "700",
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: "600",
  },
  handle: {
    fontSize: 12,
    fontWeight: "400",
  },
  weatherTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginHorizontal: 14,
    marginBottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  weatherText: {
    fontSize: 11,
    fontWeight: "500",
  },
  imagePlaceholder: {
    aspectRatio: 4 / 3,
    marginHorizontal: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 12,
  },
  placeholderText: {
    fontSize: 13,
    fontWeight: "500",
  },
  caption: {
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 20,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  tagText: {
    fontSize: 11,
    fontWeight: "500",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  actionCount: {
    fontSize: 13,
    fontWeight: "500",
  },
});
