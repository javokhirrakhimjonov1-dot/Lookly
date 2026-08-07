import {
  buildMissingChecklist,
  filterClimateSafeProducts,
  filterProfileShopProducts,
  formatGeoLabel,
  formatGeoRegion,
  getTripClimate,
  isWardrobeClimateCompatible,
  rankWardrobeForTrip,
  tierForKind,
  type ClimateShopProduct,
  type ClimateWardrobeItem,
} from "./packTripClimate";

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

assert(
  formatGeoLabel({ name: "Istanbul", admin1: "Istanbul", country: "Republic of Türkiye" })
    === "Istanbul, Republic of Türkiye",
  "City-state destinations must not repeat the city as their region",
);
assert(
  formatGeoRegion({ name: "Reykjavik", admin1: "Capital Region", country: "Iceland" })
    === "Capital Region, Iceland",
  "Distinct administrative regions must remain visible",
);

const products: Array<ClimateShopProduct & { id: string }> = [
  { id: "tee", kind: "tops", name: "Short-sleeve cotton tee", supportedTiers: ["mild", "warm", "hot"] },
  { id: "overshirt", kind: "outerwear", name: "Lightweight overshirt", supportedTiers: ["cool", "mild", "warm"] },
  { id: "sandals", kind: "shoes", name: "Open-toe sandals", supportedTiers: ["warm", "hot"] },
];

const genderedProducts: Array<ClimateShopProduct & { id: string }> = [
  { id: "women-blouse", audience: "female", kind: "tops", name: "Cotton blouse", supportedTiers: ["warm", "hot"] },
  { id: "men-tee", audience: "male", kind: "tops", name: "Men's cotton tee", supportedTiers: ["warm", "hot"] },
  { id: "umbrella", audience: "all", kind: "accessories", name: "Compact umbrella", supportedTiers: ["warm", "hot"] },
];
const femaleProducts = filterProfileShopProducts(genderedProducts, "female");
assert(femaleProducts.some((item) => item.id === "women-blouse"), "Female profiles must retain women's products");
assert(!femaleProducts.some((item) => item.id === "men-tee"), "Female profiles must reject men's products");
const maleProducts = filterProfileShopProducts(genderedProducts, "male");
assert(!maleProducts.some((item) => item.id === "women-blouse"), "Male profiles must reject women's products");
assert(maleProducts.some((item) => item.id === "umbrella"), "Shared weather gear must remain available to every profile");

const freezingTops = filterClimateSafeProducts(products, "tops", "freezing", false);
assert(freezingTops.length === 0, "Freezing trips must reject short-sleeve catalog tops");

const freezingOuterwear = filterClimateSafeProducts(products, "outerwear", "freezing", false);
assert(freezingOuterwear.length === 0, "Freezing trips must reject lightweight outerwear");

const warmTops = filterClimateSafeProducts(products, "tops", "warm", false);
assert(warmTops.some((item) => item.id === "tee"), "Warm trips should retain breathable tees");

const warmShoes = filterClimateSafeProducts(products, "shoes", "warm", false);
assert(warmShoes.some((item) => item.id === "sandals"), "Dry warm trips should retain sandals");

const rainyShoes = filterClimateSafeProducts(products, "shoes", "warm", true);
assert(rainyShoes.length === 0, "Rainy trips must reject open-toe footwear");

const mixedClimate = getTripClimate([
  { tempMax: 30, tempMin: -5 },
  { tempMax: 30, tempMin: 20 },
]);
assert(mixedClimate.summaryTier === "mild", "Mixed forecast should keep its mild summary tier");
assert(mixedClimate.safetyTier === "freezing", "Mixed forecast must preserve its freezing safety tier");
assert(
  tierForKind("outerwear", mixedClimate.summaryTier, mixedClimate.safetyTier) === "freezing",
  "Outerwear must use the coldest-low safety tier",
);
assert(
  tierForKind("shoes", mixedClimate.summaryTier, mixedClimate.safetyTier) === "freezing",
  "Shoes must use the coldest-low safety tier",
);

const checklist = buildMissingChecklist("tops", 8, "freezing", false);
assert(
  checklist.reduce((sum, item) => sum + item.quantity, 0) === 8,
  "Checklist quantities must exactly cover every unresolved slot",
);
assert(
  checklist.every((item) => !/tee|short-sleeve/i.test(item.name) || /heat-tech/i.test(item.name)),
  "Freezing checklist must contain winter-safe layers",
);

const wardrobe: ClimateWardrobeItem[] = [
  { name: "Plain heavy shirt", category: "tops", seasons: ["summer"], fabricWeight: "heavy", tags: [], timesWorn: 0 },
  { name: "Thermal winter layer", category: "tops", seasons: ["winter"], fabricWeight: "medium", tags: ["thermal"], timesWorn: 0 },
];
const rankedWardrobe = rankWardrobeForTrip(wardrobe, "freezing", false);
assert(rankedWardrobe[0]?.name === "Thermal winter layer", "Verified winter layers must rank ahead of unsuitable seasonal items");

const ordinarySneaker: ClimateWardrobeItem = {
  name: "Navy lace-up sneakers", category: "shoes", seasons: ["spring", "summer"], fabricWeight: "medium", tags: ["sneaker"], timesWorn: 0,
};
const insulatedBoot: ClimateWardrobeItem = {
  name: "Insulated winter boots", category: "shoes", seasons: ["winter"], fabricWeight: "heavy", tags: ["boot", "insulated"], timesWorn: 0,
};
assert(!isWardrobeClimateCompatible(ordinarySneaker, "freezing"), "Ordinary sneakers must be rejected in freezing weather");
assert(isWardrobeClimateCompatible(insulatedBoot, "freezing"), "Insulated winter boots must remain eligible in freezing weather");

console.log("packTripClimate acceptance tests passed");
