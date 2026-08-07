import { recommend } from "./weatherEngine";
import type { Item, UserProfile, Weather } from "./weatherEngine";

const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };
const base = (id: string, overrides: Partial<Item>): Item => ({
  id, name:id, category:"tops", color:"black", seasons:[], weight:"medium", tags:["casual"], ...overrides,
});
const mild: Weather = { tempC:22, condition:"clear", timeOfDay:"day", monthIndex:5 };
const profile = (gender?: string): UserProfile => ({ gender, stylePreferences:["casual"], stylingPreferences:{ coverage:"no_preference", silhouette:"balanced", heels:"any" } });

const neutralWardrobe = [
  base("blouse", { category:"tops", garmentFamily:"blouse", silhouette:"fitted" }),
  base("skirt", { category:"bottoms", garmentFamily:"skirt", silhouette:"a-line", length:"midi" }),
  base("flats", { category:"shoes", garmentFamily:"pumps", toeStyle:"closed", heelType:"flat", heelHeight:"flat" }),
];
const ids = (value: ReturnType<typeof recommend>) => Array.isArray(value) ? value[0]!.outfit.map(i=>i.id).sort().join("|") : "incomplete";
const baseline = ids(recommend(neutralWardrobe, mild, profile()));
for (const gender of ["male", "female", "non-binary", "prefer_not_to_say"]) {
  assert(ids(recommend(neutralWardrobe, mild, profile(gender))) === baseline, `gender ${gender} must not change garment eligibility`);
}

const maleWithStaleFemalePreferences: UserProfile = {
  ...profile("male"),
  stylingPreferences:{ coverage:"maximum_coverage", silhouette:"relaxed", heels:"flats", hijabPreference:"always" },
};
assert(
  Array.isArray(recommend(neutralWardrobe, mild, maleWithStaleFemalePreferences)),
  "female-only styling preferences persisted on a male profile must be ignored",
);

const cold: Weather = { tempC:6, condition:"cloudy", windKmh:8, timeOfDay:"day", monthIndex:0 };
const dressWardrobe = [
  base("dress", { category:"dresses", garmentFamily:"dress", silhouette:"a-line", length:"midi", weight:"heavy", warm:true }),
  base("tights", { category:"socks", garmentFamily:"tights", weight:"medium", warm:true }),
  base("boots", { category:"shoes", garmentFamily:"boots", toeStyle:"closed", bootShaft:"knee", weight:"heavy", warm:true }),
  base("coat", { category:"outerwear", garmentFamily:"coat", weight:"heavy", warm:true }),
];
const coldResult = recommend(dressWardrobe, cold, profile("female"));
assert(Array.isArray(coldResult), "cold dress wardrobe must create a complete outfit");
if (Array.isArray(coldResult)) {
  const categories = coldResult[0]!.outfit.map(i=>i.category);
  assert(categories.includes("dresses") && categories.includes("socks"), "cold dress look must add available tights");
  assert(!categories.includes("tops") && !categories.includes("bottoms"), "one-piece look must not include redundant separates");
  assert(coldResult[0]!.reasonCodes.includes("VALID_ONE_PIECE_TEMPLATE"), "one-piece reason code must be stable");
}

const rainy: Weather = { tempC:16, condition:"rainy", rainProbability:0.8, timeOfDay:"day", monthIndex:9 };
const rainWardrobe = [
  base("bodysuit", { category:"tops", garmentFamily:"bodysuit" }),
  base("trousers", { category:"bottoms", garmentFamily:"trousers" }),
  base("sandals", { category:"shoes", toeStyle:"open", heelType:"stiletto", heelHeight:"high" }),
  base("rain-boots", { category:"shoes", toeStyle:"closed", bootShaft:"ankle", waterproof:true }),
];
const rainResult = recommend(rainWardrobe, rainy, profile("female"));
assert(Array.isArray(rainResult) && rainResult.every(result => !result.outfit.some(i=>i.id === "sandals")), "rain must reject open-toe high heels");

console.log("Women's fashion parity acceptance checks passed");
