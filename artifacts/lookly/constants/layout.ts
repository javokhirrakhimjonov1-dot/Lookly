import { Platform } from "react-native";

export const WEB_TOP_PADDING = 67;
export const WEB_BOTTOM_PADDING = 20;

export function getTopPadding(insetsTop: number): number {
  return Platform.OS === "web" ? WEB_TOP_PADDING : insetsTop;
}

export function getBottomPadding(insetsBottom: number, extra = 0): number {
  return Platform.OS === "web" ? WEB_BOTTOM_PADDING + extra : insetsBottom + extra;
}
