const WARM_BASE = "#F9F8F6";
const DEFAULT_GARMENT = "#C8906A";
const DEFAULT_BORDER = "#E8E2DA";

type Rgb = { r: number; g: number; b: number };

function parseHex(value?: string | null): Rgb | null {
  const raw = value?.trim().replace(/^#/, "") ?? "";
  const normalized = /^[0-9a-f]{3}$/i.test(raw)
    ? raw.split("").map((character) => character + character).join("")
    : raw;
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return null;
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function toHex(color: Rgb): string {
  const channel = (value: number) => Math.round(value).toString(16).padStart(2, "0");
  return `#${channel(color.r)}${channel(color.g)}${channel(color.b)}`.toUpperCase();
}

function mix(base: Rgb, accent: Rgb, accentAmount: number): Rgb {
  return {
    r: base.r * (1 - accentAmount) + accent.r * accentAmount,
    g: base.g * (1 - accentAmount) + accent.g * accentAmount,
    b: base.b * (1 - accentAmount) + accent.b * accentAmount,
  };
}

function distance(left: Rgb, right: Rgb): number {
  return Math.sqrt(
    (left.r - right.r) ** 2 +
    (left.g - right.g) ** 2 +
    (left.b - right.b) ** 2,
  );
}

export interface GarmentTone {
  background: string;
  border: string;
  stronger: string;
  garment: string;
}

export function getGarmentTone(colorHex?: string | null, themeBorder = DEFAULT_BORDER): GarmentTone {
  const base = parseHex(WARM_BASE)!;
  const garment = parseHex(colorHex) ?? parseHex(DEFAULT_GARMENT)!;
  const backgroundRgb = mix(base, garment, 0.12);
  const borderRgb = mix(base, garment, 0.28);
  const fallbackBorder = parseHex(themeBorder) ?? parseHex(DEFAULT_BORDER)!;
  return {
    background: toHex(backgroundRgb),
    border: toHex(distance(backgroundRgb, borderRgb) < 18 ? fallbackBorder : borderRgb),
    stronger: toHex(mix(base, garment, 0.2)),
    garment: toHex(garment),
  };
}
