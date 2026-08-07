import React from "react";
import Svg, { Path } from "react-native-svg";

type AiPickIconProps = {
  color?: string;
  size?: number;
};

/** Infinity mark with styling sparkles used for AI outfit actions. */
export function AiPickIcon({ color = "#000000", size = 48 }: AiPickIconProps) {
  return (
    <Svg
      width={size}
      height={size * 0.625}
      viewBox="0 0 48 30"
      fill="none"
      accessibilityRole="image"
    >
      <Path
        d="M3.5 16.5C7.6 7.9 13.5 7.9 21.5 16.5C29.5 25.1 35.4 25.1 39.5 16.5C35.4 7.9 29.5 7.9 21.5 16.5C13.5 25.1 7.6 25.1 3.5 16.5Z"
        stroke={color}
        strokeWidth={2.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M27 1.5C27.35 4.35 28.65 5.65 31.5 6C28.65 6.35 27.35 7.65 27 10.5C26.65 7.65 25.35 6.35 22.5 6C25.35 5.65 26.65 4.35 27 1.5Z"
        fill={color}
      />
      <Path
        d="M38.5 7.5C38.9 10.75 40.25 12.1 43.5 12.5C40.25 12.9 38.9 14.25 38.5 17.5C38.1 14.25 36.75 12.9 33.5 12.5C36.75 12.1 38.1 10.75 38.5 7.5Z"
        fill={color}
      />
    </Svg>
  );
}
