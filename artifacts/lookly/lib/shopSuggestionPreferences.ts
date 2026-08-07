export const SHOP_SUGGESTION_TYPES = [
  "jumper",
  "blouse",
  "t-shirt",
  "shorts",
  "skirt",
  "trousers",
  "hoodie",
  "long-sleeve-top",
  "joggers",
  "overshirt",
  "jeans",
  "chinos",
  "sandals",
  "belt",
  "other",
] as const;

export type ShopSuggestionType = typeof SHOP_SUGGESTION_TYPES[number];

export function getShopSuggestionType(name: string): ShopSuggestionType {
  const text = name.toLowerCase();
  if (/long[ -]?sleeve/.test(text)) return "long-sleeve-top";
  if (/t-?shirt|\btee\b/.test(text)) return "t-shirt";
  if (text.includes("jumper")) return "jumper";
  if (text.includes("blouse")) return "blouse";
  if (text.includes("shorts")) return "shorts";
  if (text.includes("skirt")) return "skirt";
  if (text.includes("trousers")) return "trousers";
  if (text.includes("hoodie")) return "hoodie";
  if (text.includes("joggers")) return "joggers";
  if (text.includes("overshirt")) return "overshirt";
  if (text.includes("jeans")) return "jeans";
  if (text.includes("chinos")) return "chinos";
  if (/sandal|open[ -]?toe/.test(text)) return "sandals";
  if (text.includes("belt")) return "belt";
  return "other";
}

const TYPE_LABELS: Record<ShopSuggestionType, string> = {
  jumper: "Jumpers",
  blouse: "Blouses",
  "t-shirt": "T-shirts",
  shorts: "Shorts",
  skirt: "Skirts",
  trousers: "Trousers",
  hoodie: "Hoodies",
  "long-sleeve-top": "Long-sleeve tops",
  joggers: "Joggers",
  overshirt: "Overshirts",
  jeans: "Jeans",
  chinos: "Chinos",
  sandals: "Sandals",
  belt: "Belts",
  other: "Similar items",
};

export function shopSuggestionTypeLabel(type: ShopSuggestionType): string {
  return TYPE_LABELS[type];
}

/** Supplier products do not yet expose detailed coverage metadata. Keep this
 * allowlist deliberately conservative when a profile always wears hijab. */
export function isVerifiedModestShopType(type: ShopSuggestionType, kind: string): boolean {
  if (kind === "shoes" || kind === "accessories") return true;
  return [
    "jumper",
    "hoodie",
    "long-sleeve-top",
    "trousers",
    "joggers",
    "overshirt",
    "jeans",
    "chinos",
  ].includes(type);
}
