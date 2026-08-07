import React from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Svg, { Path } from "react-native-svg";

import type { Gender } from "@/contexts/UserProfileContext";
import type { ClothingCategory } from "@/contexts/WardrobeContext";

type ClothingCategoryIconProps = {
  category: ClothingCategory;
  color: string;
  gender?: Gender | null;
  size?: number;
};

const legacyIconNames: Record<ClothingCategory, React.ComponentProps<typeof MaterialCommunityIcons>["name"]> = {
  tops: "tshirt-crew-outline",
  bottoms: "human-male",
  dresses: "human-female",
  outerwear: "hanger",
  shoes: "shoe-sneaker",
  socks: "foot-print",
  accessories: "sunglasses",
};

const paths: Record<ClothingCategory, string> = {
  tops:
    "M8.2 3.25 10.1 5h3.8l1.9-1.75 4.55 2.9-2.25 3.6-2.1-1.2V21H8V8.55l-2.1 1.2-2.25-3.6 4.55-2.9Z",
  bottoms:
    "M6.2 3h11.6l-.55 7.15L15.75 21h-4.1L12 11.85 12.35 21h-4.1l-1.5-10.85L6.2 3Z",
  dresses:
    "M9.2 3h5.6l.7 4.25-1.6 2.05L18.4 21H5.6l4.5-11.7-1.6-2.05L9.2 3Z",
  outerwear:
    "M8.15 3.2 11 5.05 9.8 8.2 12 9.45l2.2-1.25L13 5.05l2.85-1.85 4.05 3.45-2.05 4.05L16.4 9.6V21H7.6V9.6l-1.45 1.1L4.1 6.65l4.05-3.45ZM11.35 10.35V21h1.3V10.35h-1.3Z",
  shoes:
    "M4 12.15c2.4.1 4.15.55 5.8 1.4l2.7 1.4c1.25.65 2.85 1 4.75 1.05 1.75.05 2.75.8 2.75 2.05 0 1.35-1.05 2.2-2.7 2.2H5.2c-1.55 0-2.7-.95-2.7-2.35 0-1.05.5-3 1.5-5.75Z",
  socks:
    "M8 3h7v8.15c0 1.4.65 2.15 1.95 2.8l2.05 1.05c1.55.8 2.05 2.4 1.2 3.8-.85 1.45-2.6 1.8-4.1.9l-5.5-3.25C8.85 15.4 8 13.9 8 11.85V3Z",
  accessories:
    "M3 10.2h2.05c.6-.65 1.65-1.05 3-1.05 1.85 0 3.2.75 3.75 2.05h.4c.55-1.3 1.9-2.05 3.75-2.05 1.35 0 2.4.4 3 1.05H21v1.65h-1.15v.55c0 2.65-1.45 4.25-3.9 4.25-2.35 0-3.75-1.4-3.95-3.8h-.05c-.2 2.4-1.6 3.8-3.9 3.8-2.45 0-3.9-1.6-3.9-4.25v-.55H3V10.2Zm2.85 2.1c0 1.8.7 2.65 2.2 2.65 1.45 0 2.15-.85 2.15-2.65 0-.95-.7-1.45-2.15-1.45-1.5 0-2.2.5-2.2 1.45Zm7.95 0c0 1.8.7 2.65 2.15 2.65 1.5 0 2.2-.85 2.2-2.65 0-.95-.7-1.45-2.2-1.45-1.45 0-2.15.5-2.15 1.45Z",
};

/** Female profiles use garment silhouettes; other profiles retain the original icon set. */
export function ClothingCategoryIcon({ category, color, gender, size = 22 }: ClothingCategoryIconProps) {
  if (gender !== "female") {
    return <MaterialCommunityIcons name={legacyIconNames[category]} size={size} color={color} />;
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={paths[category]} fill={color} fillRule="evenodd" clipRule="evenodd" />
    </Svg>
  );
}
