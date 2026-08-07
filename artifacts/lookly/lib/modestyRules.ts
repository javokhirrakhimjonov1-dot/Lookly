export type HijabPreference = "always" | "no" | null;

export type ModestyReasonCode =
  | "HIJAB_REQUIRED"
  | "MODEST_COVERAGE_REQUIRED"
  | "COVERAGE_DETAILS_MISSING";

export interface ModestyPreferences {
  hijabPreference?: HijabPreference;
  coverage?: "no_preference" | "modest" | "maximum_coverage";
  silhouette?: "balanced" | "fitted" | "relaxed";
}

export interface ModestyItem {
  name: string;
  category: string;
  tags?: string[];
  fit?: string;
  visualSignature?: {
    itemType?: string;
    garmentFamily?: string;
    shape?: string;
    silhouette?: string;
    length?: string;
    sleeve?: string;
    neckline?: string;
    coverage?: string;
    opacity?: string;
    features?: string[];
  };
}

const CORE_CATEGORIES = new Set(["tops", "bottoms", "dresses", "outerwear"]);
const HIJAB_PATTERN = /\b(hijab|head[ -]?scarf|khimar)\b/i;
const SHORT_LENGTH_PATTERN = /\b(shorts?|mini|micro|cropped?|crop top|above[ -]?knee)\b/i;
const MIDI_OR_LONGER_PATTERN = /\b(midi|mid[ -]?calf|ankle|full[ -]?length|maxi|floor[ -]?length|long)\b/i;
const ANKLE_OR_LONGER_PATTERN = /\b(ankle|full[ -]?length|maxi|floor[ -]?length)\b/i;
const SHORT_SLEEVE_PATTERN = /\b(sleeveless|strapless|spaghetti|cap sleeve|short sleeve|tank)\b/i;
const ELBOW_OR_LONGER_PATTERN = /\b(elbow|three[ -]?quarter|3\/4|long sleeve|wrist|full sleeve)\b/i;
const LONG_SLEEVE_PATTERN = /\b(long sleeve|wrist|full sleeve)\b/i;
const OPEN_NECK_PATTERN = /\b(v[ -]?neck|deep|plunging|low[ -]?cut|off[ -]?shoulder|halter|sweetheart|open)\b/i;
const CLOSED_NECK_PATTERN = /\b(high|crew|boat|round|mock|turtle|mandarin|closed|collared)\b/i;
const SHEER_PATTERN = /\b(sheer|transparent|see[ -]?through|semi[ -]?sheer)\b/i;
const FITTED_PATTERN = /\b(fitted|bodycon|skinny|tight|slim[ -]?fit)\b/i;

function normalizedItemText(item: ModestyItem): string {
  const signature = item.visualSignature ?? {};
  return [
    item.name,
    ...(item.tags ?? []),
    signature.itemType,
    signature.garmentFamily,
    signature.shape,
    signature.silhouette,
    signature.length,
    signature.sleeve,
    signature.neckline,
    signature.coverage,
    signature.opacity,
    ...(signature.features ?? []),
    item.fit,
  ].filter(Boolean).join(" ").toLowerCase();
}

export function isHijabItem(item: ModestyItem): boolean {
  return item.category === "accessories" && HIJAB_PATTERN.test(normalizedItemText(item));
}

export function getModestyIssue(
  item: ModestyItem,
  preferences?: ModestyPreferences,
): ModestyReasonCode | null {
  if (preferences?.hijabPreference !== "always" || !CORE_CATEGORIES.has(item.category)) return null;
  const coverage = preferences.coverage ?? "maximum_coverage";
  if (coverage === "no_preference") return null;

  const signature = item.visualSignature ?? {};
  const text = normalizedItemText(item);
  const declaredCoverage = (signature.coverage ?? "").toLowerCase();
  const declaredOpaque = (signature.opacity ?? "").toLowerCase();
  const silhouette = `${signature.silhouette ?? ""} ${signature.shape ?? ""} ${item.fit ?? ""}`.toLowerCase();
  const length = `${signature.length ?? ""} ${signature.itemType ?? ""} ${signature.garmentFamily ?? ""} ${item.name}`.toLowerCase();
  const sleeve = (signature.sleeve ?? "").toLowerCase();
  const neckline = (signature.neckline ?? "").toLowerCase();

  if (SHORT_LENGTH_PATTERN.test(text) || SHORT_SLEEVE_PATTERN.test(text) || OPEN_NECK_PATTERN.test(neckline)) {
    return "MODEST_COVERAGE_REQUIRED";
  }
  if (SHEER_PATTERN.test(text) || (declaredOpaque && declaredOpaque !== "opaque" && declaredOpaque !== "not-applicable")) {
    return "MODEST_COVERAGE_REQUIRED";
  }
  if (preferences.silhouette === "relaxed" && FITTED_PATTERN.test(silhouette)) {
    return "MODEST_COVERAGE_REQUIRED";
  }

  if (declaredCoverage === "maximum" || declaredCoverage === "maximum_coverage") return null;
  if (coverage === "modest" && (declaredCoverage === "modest" || declaredCoverage === "maximum" || declaredCoverage === "maximum_coverage")) return null;

  const needsSleeves = item.category === "tops" || item.category === "dresses" || item.category === "outerwear";
  const needsLongLength = item.category === "bottoms" || item.category === "dresses";
  const sleeveOk = !needsSleeves || (coverage === "maximum_coverage" ? LONG_SLEEVE_PATTERN.test(sleeve) : ELBOW_OR_LONGER_PATTERN.test(sleeve));
  const lengthOk = !needsLongLength || (coverage === "maximum_coverage" ? ANKLE_OR_LONGER_PATTERN.test(length) : MIDI_OR_LONGER_PATTERN.test(length));
  const necklineOk = item.category === "bottoms" || CLOSED_NECK_PATTERN.test(neckline);

  if (!sleeveOk || !lengthOk || !necklineOk) {
    const hasRelevantDetails = Boolean(declaredCoverage || signature.sleeve || signature.length || signature.neckline);
    return hasRelevantDetails ? "MODEST_COVERAGE_REQUIRED" : "COVERAGE_DETAILS_MISSING";
  }
  return null;
}

export function isAutomaticItemEligible(item: ModestyItem, preferences?: ModestyPreferences): boolean {
  return getModestyIssue(item, preferences) === null;
}

export function getOutfitModestyIssues(
  items: ModestyItem[],
  preferences?: ModestyPreferences,
): ModestyReasonCode[] {
  if (preferences?.hijabPreference !== "always") return [];
  const issues = new Set<ModestyReasonCode>();
  if (!items.some(isHijabItem)) issues.add("HIJAB_REQUIRED");
  for (const item of items) {
    const issue = getModestyIssue(item, preferences);
    if (issue) issues.add(issue);
  }
  return [...issues];
}
