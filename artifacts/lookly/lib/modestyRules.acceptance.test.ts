import { getModestyIssue, getOutfitModestyIssues, isHijabItem } from "./modestyRules";

const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };
const preferences = { hijabPreference:"always" as const, coverage:"maximum_coverage" as const, silhouette:"relaxed" as const };
const hijab = { name:"Silk headscarf", category:"accessories", tags:["hijab"] };
const winterScarf = { name:"Wool winter scarf", category:"accessories", tags:["warm"] };
const maxi = { name:"Maxi skirt", category:"bottoms", visualSignature:{ length:"maxi", coverage:"maximum", silhouette:"a-line", opacity:"opaque" } };
const shorts = { name:"Cotton shorts", category:"bottoms", visualSignature:{ length:"short", coverage:"maximum", opacity:"opaque" } };

assert(isHijabItem(hijab), "a positively identified headscarf must count as hijab");
assert(!isHijabItem(winterScarf), "a generic winter scarf must not count as hijab");
assert(getModestyIssue(maxi, preferences) === null, "maximum-coverage maxi skirt must remain eligible");
assert(getModestyIssue(shorts, preferences) === "MODEST_COVERAGE_REQUIRED", "shorts must be blocked even with incorrect maximum metadata");
assert(getOutfitModestyIssues([maxi], preferences).includes("HIJAB_REQUIRED"), "outfits without hijab must be incomplete");
assert(getOutfitModestyIssues([maxi, hijab], preferences).length === 0, "compatible garments plus hijab must pass");

console.log("Client modesty rule acceptance checks passed");
