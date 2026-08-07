declare module "lucide-react-native" {
  import type React from "react";
  import type { StyleProp, ViewStyle } from "react-native";
  export type LucideIcon = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number; style?: StyleProp<ViewStyle> }>;
  const icons: Record<string, LucideIcon>;
  export = icons;
}
