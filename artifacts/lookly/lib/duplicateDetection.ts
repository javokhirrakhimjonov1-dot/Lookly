import type { ClothingCategory, ClothingVisualSignature, FabricWeight } from "@/contexts/WardrobeContext";

export interface DuplicateComparable {
  id?: string;
  name: string;
  category: ClothingCategory;
  color: string;
  colorHex: string;
  fabricWeight?: FabricWeight;
  tags?: string[];
  visualSignature?: ClothingVisualSignature;
}

export interface DuplicateCandidate<T extends DuplicateComparable = DuplicateComparable> {
  item: T;
  score: number;
  contradictions: string[];
}

const STOP_WORDS = new Set([
  "and", "the", "with", "for", "blend", "piece", "clothing", "item", "colored", "colour",
]);

function normalized(value: string | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/smart[ -]?watch/g, "smartwatch")
    .replace(/wrist[ -]?watch/g, "wristwatch")
    .replace(/button[ -]?down/g, "buttondown")
    .replace(/crew[ -]?neck/g, "crewneck")
    .replace(/open[ -]?toe/g, "opentoe")
    .replace(/closed[ -]?toe/g, "closedtoe")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokens(value: string | undefined): Set<string> {
  return new Set(normalized(value).split(/\s+/).filter((word) => word.length > 2 && !STOP_WORDS.has(word)));
}

function overlap(left: Iterable<string>, right: Iterable<string>): number {
  const a = new Set(left);
  const b = new Set(right);
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const value of a) if (b.has(value)) shared += 1;
  return shared / Math.max(a.size, b.size);
}

function signatureText(item: DuplicateComparable): string {
  const signature = item.visualSignature;
  return [
    item.name,
    ...(item.tags ?? []),
    signature?.itemType,
    signature?.garmentFamily,
    signature?.shape,
    signature?.silhouette,
    signature?.length,
    signature?.pattern,
    signature?.materialFamily,
    signature?.sleeve,
    signature?.collar,
    signature?.neckline,
    signature?.rise,
    signature?.coverage,
    signature?.toeStyle,
    signature?.heelType,
    signature?.heelHeight,
    signature?.bootShaft,
    ...(signature?.closures ?? []),
    ...(signature?.features ?? []),
  ].filter(Boolean).join(" ");
}

const CONTRADICTION_GROUPS = [
  ["digital", "analog"],
  ["round", "rectangular", "square"],
  ["long sleeve", "short sleeve", "sleeveless"],
  ["opentoe", "closedtoe"],
  ["solid", "striped", "checked", "plaid", "printed", "polka dot"],
] as const;

export function structuralContradictions(left: DuplicateComparable, right: DuplicateComparable): string[] {
  const a = normalized(signatureText(left));
  const b = normalized(signatureText(right));
  const contradictions: string[] = [];
  for (const group of CONTRADICTION_GROUPS) {
    const aValue = group.find((value) => a.includes(normalized(value)));
    const bValue = group.find((value) => b.includes(normalized(value)));
    if (aValue && bValue && aValue !== bValue) contradictions.push(`${aValue} vs ${bValue}`);
  }
  return contradictions;
}

function parseHex(hex: string): [number, number, number] | null {
  const match = hex.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!match) return null;
  const value = match[1]!;
  return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)];
}

function colorSimilarity(left: DuplicateComparable, right: DuplicateComparable): number {
  if (normalized(left.color) === normalized(right.color)) return 1;
  const a = parseHex(left.colorHex);
  const b = parseHex(right.colorHex);
  if (!a || !b) return 0;
  const distance = Math.sqrt(
    ((a[0] - b[0]) / 255) ** 2 + ((a[1] - b[1]) / 255) ** 2 + ((a[2] - b[2]) / 255) ** 2,
  ) / Math.sqrt(3);
  return Math.max(0, 1 - distance * 2);
}

function signatureSimilarity(left: DuplicateComparable, right: DuplicateComparable): number {
  const a = left.visualSignature;
  const b = right.visualSignature;
  if (!a || !b) return 0;
  const fields = ["itemType", "garmentFamily", "shape", "silhouette", "length", "pattern", "materialFamily", "sleeve", "collar", "neckline", "rise", "coverage", "toeStyle", "heelType", "heelHeight", "bootShaft"] as const;
  const values: number[] = [];
  for (const field of fields) {
    const leftValue = normalized(a[field]);
    const rightValue = normalized(b[field]);
    // Accessories legitimately have no sleeve, neckline, rise, heel, etc.
    // Empty or not-applicable garment fields carry no evidence either way and
    // must not dilute the few construction details that identify a watch, bag,
    // belt, or piece of jewellery.
    if (!leftValue || !rightValue || leftValue === "not applicable" || rightValue === "not applicable") continue;
    values.push(overlap(tokens(leftValue), tokens(rightValue)));
  }
  if (a.closures.length > 0 && b.closures.length > 0) {
    values.push(overlap(a.closures.map(normalized), b.closures.map(normalized)));
  }
  if (a.features.length > 0 && b.features.length > 0) {
    values.push(overlap(tokens(a.features.join(" ")), tokens(b.features.join(" "))));
  }
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

export function duplicateMetadataScore(left: DuplicateComparable, right: DuplicateComparable): DuplicateCandidate {
  if (left.category !== right.category) return { item: right, score: 0, contradictions: ["different category"] };
  const contradictions = structuralContradictions(left, right);
  if (contradictions.length) return { item: right, score: 0, contradictions };

  const color = colorSimilarity(left, right);
  if (color < 0.45) return { item: right, score: 0, contradictions: ["different color family"] };
  const name = overlap(tokens(left.name), tokens(right.name));
  const tag = overlap(left.tags?.map(normalized) ?? [], right.tags?.map(normalized) ?? []);
  const signature = signatureSimilarity(left, right);
  const weight = left.fabricWeight && right.fabricWeight && left.fabricWeight === right.fabricWeight ? 1 : 0;
  const hasBothSignatures = Boolean(left.visualSignature && right.visualSignature);
  const score = hasBothSignatures
    ? color * 0.2 + signature * 0.5 + name * 0.15 + tag * 0.1 + weight * 0.05
    : color * 0.35 + name * 0.4 + tag * 0.15 + weight * 0.1;
  return { item: right, score: Math.round(score * 1000) / 1000, contradictions: [] };
}

export function shortlistDuplicateCandidates<T extends DuplicateComparable>(
  item: DuplicateComparable,
  wardrobe: T[],
  limit = 3,
): DuplicateCandidate<T>[] {
  return wardrobe
    .map((candidate) => duplicateMetadataScore(item, candidate) as DuplicateCandidate<T>)
    .filter((candidate) => candidate.score >= 0.42 && candidate.contradictions.length === 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function isHighConfidenceMetadataDuplicate(candidate: DuplicateCandidate): boolean {
  return candidate.contradictions.length === 0 && candidate.score >= 0.92;
}

/**
 * AI often describes the same item with reordered words, while a generated
 * catalog image can slightly alter its collar or drape. A sufficiently long,
 * near-identical description is therefore decisive unless a stable structural
 * contradiction was found first.
 */
export function isNearIdenticalDescriptionDuplicate(
  left: DuplicateComparable,
  candidate: DuplicateCandidate,
): boolean {
  if (left.category !== candidate.item.category || candidate.contradictions.length > 0) return false;
  if (colorSimilarity(left, candidate.item) < 0.85) return false;
  const leftTokens = tokens(left.name);
  const rightTokens = tokens(candidate.item.name);
  if (Math.min(leftTokens.size, rightTokens.size) < 4) return false;
  return overlap(leftTokens, rightTokens) >= 0.85;
}

export function defaultDuplicateSelection(items: Array<{ _isDuplicate?: boolean }>): Set<number> {
  return new Set(items.map((_, index) => index).filter((index) => !items[index]?._isDuplicate));
}
