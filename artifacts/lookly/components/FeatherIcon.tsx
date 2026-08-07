import * as LucideIcons from "lucide-react-native";
import React from "react";
import type { StyleProp, ViewStyle } from "react-native";

type FeatherIconProps = {
  name: string;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
};

type SvgIcon = React.ComponentType<{
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
  strokeWidth?: number;
}>;

const iconLibrary = LucideIcons as unknown as Record<string, SvgIcon>;

function toComponentName(name: string): string {
  return name.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join("");
}

/** Font-free Feather-compatible icon used across native and web builds. */
export function Feather({ name, size = 24, color = "#000000", style }: FeatherIconProps) {
  const Icon = iconLibrary[toComponentName(name)] ?? iconLibrary.Circle;
  return <Icon size={size} color={color} style={style} strokeWidth={2} />;
}
