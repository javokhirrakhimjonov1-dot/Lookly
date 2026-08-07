import type { Item, UserProfile } from "./weatherEngine";

export type ModestyReasonCode = "HIJAB_REQUIRED" | "MODEST_COVERAGE_REQUIRED" | "COVERAGE_DETAILS_MISSING";
const CORE = new Set(["tops", "bottoms", "dresses", "outerwear"]);
const HIJAB = /\b(hijab|head[ -]?scarf|khimar)\b/i;
const SHORT = /\b(shorts?|mini|micro|cropped?|crop top|above[ -]?knee)\b/i;
const MIDI = /\b(midi|mid[ -]?calf|ankle|full[ -]?length|maxi|floor[ -]?length|long)\b/i;
const ANKLE = /\b(ankle|full[ -]?length|maxi|floor[ -]?length)\b/i;
const SHORT_SLEEVE = /\b(sleeveless|strapless|spaghetti|cap sleeve|short sleeve|tank)\b/i;
const ELBOW_SLEEVE = /\b(elbow|three[ -]?quarter|3\/4|long sleeve|wrist|full sleeve)\b/i;
const LONG_SLEEVE = /\b(long sleeve|wrist|full sleeve)\b/i;
const OPEN_NECK = /\b(v[ -]?neck|deep|plunging|low[ -]?cut|off[ -]?shoulder|halter|sweetheart|open)\b/i;
const CLOSED_NECK = /\b(high|crew|boat|round|mock|turtle|mandarin|closed|collared)\b/i;
const SHEER = /\b(sheer|transparent|see[ -]?through|semi[ -]?sheer)\b/i;
const FITTED = /\b(fitted|bodycon|skinny|tight|slim[ -]?fit)\b/i;

function text(item: Item): string {
  return [item.name, ...item.tags, item.garmentFamily, item.silhouette, item.length, item.sleeve, item.neckline, item.coverage, item.opacity, item.fit]
    .filter(Boolean).join(" ").toLowerCase();
}

export function isHijabItem(item: Item): boolean {
  return item.category === "accessories" && HIJAB.test(text(item));
}

export function getModestyIssue(item: Item, user: UserProfile): ModestyReasonCode | null {
  const prefs = user.stylingPreferences;
  if (prefs?.hijabPreference !== "always" || !CORE.has(item.category)) return null;
  const level = prefs.coverage ?? "maximum_coverage";
  if (level === "no_preference") return null;
  const all = text(item);
  const declared = (item.coverage ?? "").toLowerCase();
  if (SHORT.test(all) || SHORT_SLEEVE.test(all) || OPEN_NECK.test(item.neckline ?? "") || SHEER.test(all)) return "MODEST_COVERAGE_REQUIRED";
  if (item.opacity && !["opaque", "not-applicable"].includes(item.opacity)) return "MODEST_COVERAGE_REQUIRED";
  if (prefs.silhouette === "relaxed" && FITTED.test(`${item.silhouette ?? ""} ${item.fit ?? ""}`)) return "MODEST_COVERAGE_REQUIRED";
  if (["maximum", "maximum_coverage"].includes(declared)) return null;
  if (level === "modest" && ["modest", "maximum", "maximum_coverage"].includes(declared)) return null;

  const needsSleeve = ["tops", "dresses", "outerwear"].includes(item.category);
  const needsLength = ["bottoms", "dresses"].includes(item.category);
  const sleeveOk = !needsSleeve || (level === "maximum_coverage" ? LONG_SLEEVE.test(item.sleeve ?? "") : ELBOW_SLEEVE.test(item.sleeve ?? ""));
  const lengthOk = !needsLength || (level === "maximum_coverage" ? ANKLE.test(`${item.length ?? ""} ${item.garmentFamily ?? ""} ${item.name}`) : MIDI.test(`${item.length ?? ""} ${item.garmentFamily ?? ""} ${item.name}`));
  const neckOk = item.category === "bottoms" || CLOSED_NECK.test(item.neckline ?? "");
  if (!sleeveOk || !lengthOk || !neckOk) {
    return item.coverage || item.sleeve || item.length || item.neckline
      ? "MODEST_COVERAGE_REQUIRED"
      : "COVERAGE_DETAILS_MISSING";
  }
  return null;
}

export function isAutomaticItemEligible(item: Item, user: UserProfile): boolean {
  return getModestyIssue(item, user) === null;
}

export function getOutfitModestyIssues(items: Item[], user: UserProfile): ModestyReasonCode[] {
  if (user.stylingPreferences?.hijabPreference !== "always") return [];
  const issues = new Set<ModestyReasonCode>();
  if (!items.some(isHijabItem)) issues.add("HIJAB_REQUIRED");
  for (const item of items) {
    const issue = getModestyIssue(item, user);
    if (issue) issues.add(issue);
  }
  return [...issues];
}
