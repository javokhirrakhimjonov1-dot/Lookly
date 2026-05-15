import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { useColors } from "@/hooks/useColors";

interface Props {
  label: string;
  isActive: boolean;
  onPress: () => void;
  count?: number;
}

export default function CategoryPill({ label, isActive, onPress, count }: Props) {
  const colors = useColors();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        {
          backgroundColor: isActive ? colors.primary : colors.secondary,
          opacity: pressed ? 0.8 : 1,
          transform: [{ scale: pressed ? 0.96 : 1 }],
        },
      ]}
    >
      <Text
        style={[
          styles.label,
          { color: isActive ? colors.primaryForeground : colors.mutedForeground },
        ]}
      >
        {label}
        {count !== undefined && count > 0 ? ` ${count}` : ""}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 100,
    marginRight: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
  },
});
