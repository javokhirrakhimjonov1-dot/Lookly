import { recommend } from "./weatherEngine";
import type { Item, UserProfile, Weather } from "./weatherEngine";

const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };
const item = (id: string, overrides: Partial<Item>): Item => ({
  id, name:id, category:"tops", color:"black", seasons:[], weight:"medium", tags:["casual"], ...overrides,
});
const weather: Weather = { tempC:22, condition:"clear", timeOfDay:"day", monthIndex:5 };
const profile: UserProfile = {
  gender:"female",
  stylePreferences:["casual"],
  stylingPreferences:{ coverage:"maximum_coverage", silhouette:"relaxed", heels:"any", hijabPreference:"always" },
};
const wardrobe = [
  item("long-tunic", { category:"tops", coverage:"maximum", sleeve:"long", neckline:"high", silhouette:"straight" }),
  item("short-sleeve-top", { category:"tops", coverage:"maximum", sleeve:"short", neckline:"crew", silhouette:"relaxed" }),
  item("maxi-skirt", { category:"bottoms", coverage:"maximum", length:"maxi", silhouette:"a-line" }),
  item("shorts", { category:"bottoms", coverage:"maximum", length:"short", silhouette:"relaxed" }),
  item("flats", { category:"shoes", toeStyle:"closed", heelType:"flat", heelHeight:"flat" }),
  item("navy-hijab", { category:"accessories", garmentFamily:"hijab", coverage:"maximum" }),
];

const result = recommend(wardrobe, weather, profile);
assert(Array.isArray(result), "a complete hijab-aware wardrobe must produce outfits");
if (Array.isArray(result)) {
  assert(result.every(entry => entry.outfit.some(piece => piece.id === "navy-hijab")), "every complete outfit must contain an owned hijab");
  assert(result.every(entry => !entry.outfit.some(piece => piece.id === "shorts" || piece.id === "short-sleeve-top")), "short garments must never pass maximum coverage");
  assert(result.every(entry => entry.reasonCodes.includes("HIJAB_REQUIRED")), "hijab reason code must be exposed");
}

const missingHijab = recommend(wardrobe.filter(piece => piece.id !== "navy-hijab"), weather, profile);
assert(!Array.isArray(missingHijab) && missingHijab.reasonCodes.includes("HIJAB_REQUIRED"), "missing hijab must return an actionable incomplete state");

const unknownCoverage = recommend([
  item("unknown-top", { category:"tops" }),
  item("maxi-skirt", { category:"bottoms", coverage:"maximum", length:"maxi" }),
  item("flats", { category:"shoes" }),
  item("navy-hijab", { category:"accessories", garmentFamily:"hijab" }),
], weather, profile);
assert(!Array.isArray(unknownCoverage) && unknownCoverage.reasonCodes.includes("COVERAGE_DETAILS_MISSING"), "unknown core coverage must fail closed");

console.log("Hijab recommendation acceptance checks passed");
