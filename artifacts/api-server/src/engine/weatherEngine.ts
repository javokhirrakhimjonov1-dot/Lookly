/**
 * Lookly — Weather-Aware Outfit Selection Engine
 * ------------------------------------------------
 * Pure, dependency-free TypeScript. No React, no I/O, no framework.
 * This module is TYPE-CHECKED and RUNTIME-TESTED. Treat the scoring weights,
 * the feels-like formulas (Steadman AT, NWS wind chill), and the warmth model
 * as GROUND TRUTH — do not "simplify" or regenerate them.
 *
 * Public entry point:  recommend(wardrobe, weather, user) -> top outfits (or a fallback object)
 * Also useful:         feelsLike(weather, user) -> apparent temperature in °C
 *
 * See INTEGRATION.md for how to wire this into an app.
 */

// ============ Types ============
type Category = "tops" | "bottoms" | "dresses" | "outerwear" | "shoes" | "socks" | "accessories";
type Season   = "spring" | "summer" | "fall" | "winter";
type Weight   = "light" | "medium" | "heavy";
type Fit      = "fitted" | "regular" | "oversized" | "wide-leg";
type Condition = "clear" | "cloudy" | "windy" | "rainy" | "snowy" | "humid" | "hot";

interface Item {
  id: string; name: string; category: Category;
  color: string;            // palette key, e.g. "navy" | "red"; normalized at upload
  hue?: number;             // 0..360 for non-neutrals; undefined for neutrals
  seasons: Season[];        // [] => season-neutral
  weight: Weight;
  tags: string[];
  material?: string;        // cotton|linen|wool|denim|leather|technical|synthetic|suede|canvas
  waterproof?: boolean; windproof?: boolean; warm?: boolean;
  fit?: Fit;
  lastWornDaysAgo?: number; wearCount?: number;
}
interface Weather {
  tempC: number; condition: Condition;
  rainProbability?: number; // 0..1
  windKmh?: number;         // actual wind speed (km/h) — drives wind chill / windproof
  humidity?: number;        // relative humidity 0..100 — drives feels-like + breathability
  uvIndex?: number;         // 0..11+ — drives solar warming bump + sun protection
  timeOfDay: "morning" | "day" | "evening" | "night";
  hemisphere?: "north" | "south"; monthIndex?: number; // 0..11
}
interface UserProfile {
  age?: number; gender?: string;               // soft signals only (see B.5)
  stylePreferences: string[];
  colorPreferences?: string[];
  lifestyle?: "office" | "gym" | "student" | "casual" | "night-out" | string;
  climateZone?: "tropical" | "arid" | "temperate" | "continental" | "polar"; // acclimatization (optional, soft)
}
interface Requirements {
  band: string; minWarmth: number;             // raw warmth points (see warmthOf)
  outerwearPolicy: "required" | "recommended" | "optional" | "none";
  requireWaterproofShoes: boolean; requireWindproofOuter: boolean; requireWarmShoes: boolean;
  bannedFabrics: string[]; bannedWeights: Weight[]; sunProtection: boolean;
  wet: boolean; humid: boolean; windy: boolean;
}
interface ScoredOutfit { outfit: Item[]; score: number; why: string[]; incomplete?: boolean; }

// ============ Config ============
const WEIGHTS = {
  weatherSuitability: 0.28, styleMatch: 0.16, comfort: 0.14, colorHarmony: 0.14,
  variety: 0.08, completeness: 0.08, practicality: 0.06, occasionSuitability: 0.06,
};
const NEUTRALS = new Set(["black","white","grey","gray","beige","navy","brown","cream","olive","tan"]);
const WEIGHT_RANK: Record<Weight, number> = { light: 0, medium: 1, heavy: 2 };
const CAP_PER_CATEGORY = 12;                    // combinatorial cap
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

// ============ Season ============
function seasonOf(w: Weather): Season {
  const m = w.monthIndex ?? new Date().getMonth();      // 0..11
  const north: Season[] = ["winter","winter","spring","spring","spring","summer",
                           "summer","summer","fall","fall","fall","winter"];
  const s = north[m];
  if (w.hemisphere === "south") {                        // flip
    const flip: Record<Season, Season> = { winter:"summer", summer:"winter", spring:"fall", fall:"spring" };
    return flip[s];
  }
  return s;
}

// ============ Feels-like (apparent) temperature ============
// Water vapour pressure in hPa from air temp (°C) and relative humidity (%).
function vapourPressure(Ta: number, rh: number): number {
  return (rh / 100) * 6.105 * Math.exp((17.27 * Ta) / (237.7 + Ta));
}
// Steadman Australian Apparent Temperature — folds humidity + wind across the full range.
function steadmanAT(Ta: number, rh: number, windKmh: number): number {
  const e = vapourPressure(Ta, rh);
  const ws = windKmh / 3.6;                     // km/h -> m/s
  return Ta + 0.33 * e - 0.70 * ws - 4.0;
}
// NWS / Environment Canada metric wind chill (valid Ta <= 10°C and wind >= 4.8 km/h).
function windChillC(Ta: number, windKmh: number): number {
  if (Ta > 10 || windKmh < 4.8) return Ta;
  const v = Math.pow(windKmh, 0.16);
  return 13.12 + 0.6215 * Ta - 11.37 * v + 0.3965 * Ta * v;
}
// Clear daytime sun makes it feel warmer (full sun ~ up to +8°C at peak).
function solarBump(w: Weather): number {
  const sunny = w.condition === "clear" || w.condition === "hot";
  if (!sunny || w.timeOfDay === "night") return 0;
  const uv = w.uvIndex ?? 5;
  const timeFactor = w.timeOfDay === "day" ? 1 : 0.5;      // midday strongest
  return Math.min(6, uv * 0.7) * timeFactor;
}
// Acclimatization — CONSERVATIVE & one-directional so it can never cause under-dressing:
//   heat-climate users get lighter clothing only when it's already hot;
//   cold-climate users need slightly less bundling only when it's already cold.
// In the regime a user is *sensitive* to, we fall back to the neutral (safe) baseline.
function acclimatizationOffset(zone: string | undefined, feelsBase: number): number {
  if (feelsBase >= 24 && (zone === "tropical" || zone === "arid")) return +2;      // dress lighter
  if (feelsBase <= 5  && (zone === "polar" || zone === "continental")) return +2;  // less bundling
  return 0;
}
// Final feels-like: coldest-safe when cold+windy, humidity via Steadman, plus sun + acclimatization.
function feelsLike(w: Weather, user: UserProfile): number {
  const rh = w.humidity ?? 50;
  const wind = w.windKmh ?? 0;
  let at = steadmanAT(w.tempC, rh, wind);
  if (w.tempC <= 10 && wind >= 4.8) at = Math.min(at, windChillC(w.tempC, wind)); // pick the colder = safer
  at += solarBump(w);
  at += acclimatizationOffset(user.climateZone, at);
  return at;
}

// ============ 1. Context -> Requirements ============
function bandOf(t: number): string {
  if (t < 0) return "below0"; if (t < 8) return "0-7"; if (t < 15) return "8-14";
  if (t < 21) return "15-20"; if (t < 28) return "21-27"; return "above27";
}
// Boundary softening: return the band(s) to evaluate.
function candidateBands(t: number): string[] {
  const edges = [0, 8, 15, 21, 28];
  const bands = new Set<string>([bandOf(t)]);
  for (const e of edges) if (Math.abs(t - e) <= 1) { bands.add(bandOf(e - 0.5)); bands.add(bandOf(e + 0.5)); }
  return [...bands];
}
function deriveRequirements(w: Weather, band: string, feels: number): Requirements {
  const t = feels;                                    // clothing decisions use feels-like, not raw temp
  const wet   = w.condition === "rainy" || (w.rainProbability ?? 0) >= 0.4;
  const snow  = w.condition === "snowy";
  const windy = w.condition === "windy" || (w.windKmh ?? 0) >= 25;   // numeric OR categorical
  const humid = w.condition === "humid" || (w.humidity ?? 0) >= 70;

  let minWarmth = 0, outerwearPolicy: Requirements["outerwearPolicy"] = "none";
  let bannedWeights: Weight[] = [], bannedFabrics: string[] = [];
  switch (band) {
    case "below0":  minWarmth=6; outerwearPolicy="required";    bannedWeights=["light"];          bannedFabrics=["linen"]; break;
    case "0-7":     minWarmth=4; outerwearPolicy="required";                                      bannedFabrics=["linen"]; break;
    case "8-14":    minWarmth=2; outerwearPolicy="recommended"; break;
    case "15-20":   minWarmth=1; outerwearPolicy="optional";    bannedWeights=["heavy"];          break;
    case "21-27":   minWarmth=0; outerwearPolicy="none";        bannedWeights=["heavy"];          break;
    case "above27": minWarmth=0; outerwearPolicy="none";        bannedWeights=["heavy","medium"]; bannedFabrics=["wool"]; break;
  }
  if (wet || snow) bannedFabrics.push("suede");
  if (t > 25)      bannedFabrics.push("leather");
  // Rain/wind can re-introduce an outer requirement in mild bands:
  if ((wet || snow || windy) && outerwearPolicy === "none") outerwearPolicy = "recommended";

  return {
    band, minWarmth, outerwearPolicy,
    requireWaterproofShoes: wet || snow,
    requireWindproofOuter: windy && outerwearPolicy !== "none",
    requireWarmShoes: t < 7 || snow,
    bannedFabrics, bannedWeights,
    sunProtection: ((w.condition === "clear" || w.condition === "hot") || (w.uvIndex ?? 0) >= 6) && w.timeOfDay !== "night",
    wet, humid, windy,
  };
}

// ============ 2. Filter (hard gate) ============
function isBreathableShoe(it: Item): boolean {
  return it.material === "canvas" || it.material === "mesh" || it.tags.includes("sandals") || it.tags.includes("espadrilles");
}
function passesGate(it: Item, req: Requirements, season: Season): boolean {
  if (it.seasons.length && !it.seasons.includes(season)) return false;
  if (req.bannedWeights.includes(it.weight)) return false;
  if (it.material && req.bannedFabrics.includes(it.material)) return false;
  if (req.requireWarmShoes && it.category === "shoes" && isBreathableShoe(it)) return false;
  if ((req.wet) && it.category === "shoes" && isBreathableShoe(it)) return false; // no canvas/sandals in rain
  return true;
}

// ============ Warmth model ============
// Raw warmth points; compared directly against Requirements.minWarmth (same scale).
// Reference thresholds: below0>=6, 0-7>=4, 8-14>=2, 15-20>=1, warm bands 0.
function warmthOf(outfit: Item[]): number {
  let pts = 0;
  for (const it of outfit) {
    if (it.category === "dresses" || it.category === "tops" || it.category === "bottoms")
      pts += WEIGHT_RANK[it.weight];            // light 0, medium 1, heavy 2
    if (it.category === "outerwear") pts += WEIGHT_RANK[it.weight] + 1; // light 1 .. heavy 3
    if (it.warm) pts += 1;                      // explicit warm attribute (any item)
  }
  return pts;
}

// ============ Pre-rank (combinatorial cap) ============
function quickItemScore(it: Item, req: Requirements, user: UserProfile): number {
  let s = 0.5;
  s += user.stylePreferences.some(t => it.tags.includes(t)) ? 0.25 : 0;
  if (it.category === "outerwear") {
    if (req.requireWindproofOuter && it.windproof) s += 0.2;
    if (req.wet && it.waterproof) s += 0.2;
  }
  if (it.category === "shoes" && req.requireWaterproofShoes && it.waterproof) s += 0.25;
  s += 0.05 * ((it.lastWornDaysAgo ?? 30) / 30);          // gentle freshness nudge
  return s;
}
function topK(items: Item[], req: Requirements, user: UserProfile, k = CAP_PER_CATEGORY): Item[] {
  return [...items].sort((a,b) => quickItemScore(b,req,user) - quickItemScore(a,req,user)).slice(0, k);
}

// ============ 3. Candidate generation ============
function relaxed(f?: Fit) { return f === "oversized" || f === "wide-leg"; }
function proportionOK(top: Item, bottom: Item, user: UserProfile): boolean {
  const bothRelaxed = relaxed(top.fit) && relaxed(bottom.fit);
  const bothTight   = top.fit === "fitted" && bottom.fit === "fitted";
  const streety = user.stylePreferences.some(s => s === "sporty" || s === "streetwear");
  return !(bothRelaxed || bothTight) || streety;
}
function pickAccessories(accs: Item[], req: Requirements): Item[] {
  const out: Item[] = [];
  const want = (pred: (a: Item)=>boolean) => { const a = accs.find(pred); if (a && !out.includes(a)) out.push(a); };
  if (req.wet)                    want(a => a.tags.includes("umbrella"));
  if (req.requireWarmShoes)     { want(a => a.tags.includes("gloves")); want(a => a.tags.includes("scarf")); }
  if (req.sunProtection)        { want(a => a.tags.includes("sunglasses")); want(a => a.tags.includes("hat")); }
  // one finishing accent if room
  const accent = accs.find(a => !NEUTRALS.has(a.color) && !out.includes(a));
  if (accent && out.length < 3) out.push(accent);
  return out.slice(0, 3);
}
function* generateCandidates(pool: Item[], req: Requirements, user: UserProfile): Generator<Item[]> {
  const by = (c: Category) => pool.filter(i => i.category === c);
  const tops = topK(by("tops"),req,user), bottoms = topK(by("bottoms"),req,user);
  const dresses = topK(by("dresses"),req,user), outers = topK(by("outerwear"),req,user);
  const shoes = topK(by("shoes"),req,user), accs = by("accessories");

  const bases: Item[][] = [];
  for (const d of dresses) bases.push([d]);
  for (const t of tops) for (const b of bottoms) if (proportionOK(t,b,user)) bases.push([t,b]);

  const anyWaterproofShoe = shoes.some(s => s.waterproof);
  for (const base of bases) {
    for (const sh of shoes) {
      if (req.requireWaterproofShoes && !sh.waterproof && anyWaterproofShoe) continue;
      const outerOpts: (Item|null)[] = req.outerwearPolicy === "none"
        ? [null]
        : [...outers.filter(o => !req.requireWindproofOuter || o.windproof), null];
      for (const outer of outerOpts) {
        if (req.outerwearPolicy === "required" && outer === null && outers.length) continue;
        const acc = pickAccessories(accs, req);
        const candidate = [...base, sh, ...(outer ? [outer] : []), ...acc];
        if (warmthOf(candidate) >= req.minWarmth || !outers.length) yield candidate; // warmth gate
      }
    }
  }
}

// ============ 4. Sub-scores ============
function aggTags(o: Item[]): string[] { return o.flatMap(i => i.tags); }
function tagOverlap(o: Item[], prefs: string[]): number {
  if (!prefs.length) return 0.6;
  const tags = new Set(aggTags(o));
  const hits = prefs.filter(p => tags.has(p)).length;
  const coherence = dominantStyleCoherence(o);
  return clamp01(0.5 * (hits / prefs.length) + 0.5 * coherence);
}
function dominantStyleCoherence(o: Item[]): number {
  const styleTags = ["casual","smart casual","formal","sporty","streetwear","minimalist","classic","boho"];
  const counts: Record<string,number> = {};
  for (const t of aggTags(o)) if (styleTags.includes(t)) counts[t] = (counts[t]??0)+1;
  const vals = Object.values(counts); if (!vals.length) return 0.5;
  const total = vals.reduce((a,b)=>a+b,0), max = Math.max(...vals);
  return clamp01(max/total);                               // 1 = all pieces share one style
}
function weatherScore(o: Item[], req: Requirements, w: Weather): number {
  let s = 1.0;
  const bandRank = req.band === "above27" || req.band === "21-27" ? 0 : req.band === "15-20" ? 1 : 2;
  for (const it of o) {
    if (["tops","bottoms","dresses","outerwear"].includes(it.category)) {
      const diff = Math.abs(WEIGHT_RANK[it.weight] - bandRank);
      if (diff >= 2) s -= 0.15;                             // clearly wrong weight
    }
  }
  if (req.outerwearPolicy === "recommended" && !o.some(i => i.category === "outerwear")) s -= 0.20;
  if (req.requireWarmShoes && o.some(i => i.category === "shoes" && isBreathableShoe(i))) s -= 0.10;
  if (req.wet && o.some(i => i.category === "outerwear" && i.waterproof)) s += 0.10;   // stylishly handled
  return clamp01(s);
}
function comfortScore(o: Item[], w: Weather): number {
  let s = 1.0;
  const layers = o.filter(i => ["tops","outerwear","dresses"].includes(i.category)).length;
  if (w.tempC > 24 && layers > 2) s -= 0.2;                // over-layered in heat
  if (w.tempC > 24 && o.some(i => i.fit === "fitted" && i.weight !== "light")) s -= 0.1;
  if (w.condition === "humid" && o.some(i => i.material === "wool")) s -= 0.2;
  if (w.tempC < 8 && warmthOf(o) < 4) s -= 0.2;
  // proportion comfort
  const top = o.find(i=>i.category==="tops"), bot = o.find(i=>i.category==="bottoms");
  if (top && bot && ((relaxed(top.fit)&&relaxed(bot.fit)) || (top.fit==="fitted"&&bot.fit==="fitted"))) s -= 0.1;
  return clamp01(s);
}
function hueDelta(a: number, b: number): number { const d = Math.abs(a-b)%360; return d>180?360-d:d; }
function colorScore(o: Item[]): number {
  const colors = o.filter(i=>["tops","bottoms","dresses","outerwear","shoes"].includes(i.category));
  const nonNeutral = colors.filter(i => !NEUTRALS.has(i.color) && i.hue !== undefined);
  let s: number;
  if (nonNeutral.length === 0) s = 0.85;
  else if (nonNeutral.length === 1) s = 0.95;
  else {
    // best pairwise relationship
    let best = 0;
    for (let i=0;i<nonNeutral.length;i++) for (let j=i+1;j<nonNeutral.length;j++) {
      const d = hueDelta(nonNeutral[i].hue!, nonNeutral[j].hue!);
      const rel = (d<=40) ? 0.9 : (d>=150&&d<=210) ? 0.85 : (d<=20?0.95:0.55); // analogous/complementary/mono/clash
      best = Math.max(best, rel);
    }
    s = best - (nonNeutral.length >= 3 ? 0.2 : 0);         // 3+ brights penalty
  }
  const allMono = nonNeutral.length>=2 && nonNeutral.every(n => hueDelta(n.hue!, nonNeutral[0].hue!) <= 20);
  if (allMono) s += 0.05;
  return clamp01(s);
}
function varietyScore(o: Item[]): number {
  const core = o.filter(i => i.category !== "accessories" && i.category !== "socks");
  if (!core.length) return 1;
  const penalties = core.map(i => {
    const days = i.lastWornDaysAgo ?? 30;
    const recent = clamp01(1 - days/14);                    // worn today -> 1, 14+ days -> 0
    const freq = clamp01((i.wearCount ?? 0) / 20);
    return 0.7*recent + 0.3*freq;
  });
  return clamp01(1 - penalties.reduce((a,b)=>a+b,0)/penalties.length);
}
function completenessScore(o: Item[], req: Requirements): number {
  let s = 1.0;
  const has = (c: Category) => o.some(i => i.category === c);
  const hasBase = has("dresses") || (has("tops") && has("bottoms"));
  if (!hasBase) s -= 0.5;
  if (!has("shoes")) s -= 0.4;
  if (req.outerwearPolicy === "required" && !has("outerwear")) s -= 0.4;
  return clamp01(s);
}
function practicalityScore(o: Item[], req: Requirements): number {
  let s = 0.8;
  if (req.wet && o.some(i => i.category==="shoes" && i.waterproof)) s += 0.1;
  if (req.wet && o.some(i => i.category==="outerwear" && i.waterproof)) s += 0.1;
  if (req.requireWarmShoes && o.some(i => i.category==="shoes" && i.warm)) s += 0.05;
  if (req.wet && o.some(i => i.material === "suede")) s -= 0.3;
  return clamp01(s);
}
function occasionScore(o: Item[], user: UserProfile, w: Weather): number {
  const wantFormal = user.lifestyle === "office" || w.timeOfDay === "evening";
  const wantSporty = user.lifestyle === "gym";
  const tags = new Set(aggTags(o));
  if (wantSporty) return tags.has("sporty") ? 1 : 0.4;
  if (wantFormal) return (tags.has("formal") || tags.has("smart casual")) ? 1 : tags.has("sporty") ? 0.3 : 0.6;
  return tags.has("formal") ? 0.7 : 0.85;                  // casual default tolerant
}

// ============ 5. Score, rank, recommend ============
function scoreOutfit(o: Item[], req: Requirements, w: Weather, user: UserProfile): number {
  const s: Record<keyof typeof WEIGHTS, number> = {
    weatherSuitability: weatherScore(o, req, w),
    styleMatch: tagOverlap(o, user.stylePreferences),
    comfort: comfortScore(o, w),
    colorHarmony: colorScore(o),
    variety: varietyScore(o),
    completeness: completenessScore(o, req),
    practicality: practicalityScore(o, req),
    occasionSuitability: occasionScore(o, user, w),
  };
  let total = 0; (Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]).forEach(k => total += WEIGHTS[k]*s[k]);
  return Math.round(total * 100);
}
function rationale(o: Item[], req: Requirements, feels: number, rawTemp: number): string[] {
  const why: string[] = [];
  if (Math.abs(feels - rawTemp) >= 3)
    why.push(`dressed for a feels-like ${Math.round(feels)}°C (thermometer ${Math.round(rawTemp)}°C)`);
  if (req.wet && o.some(i=>i.category==="shoes"&&i.waterproof)) why.push("waterproof shoes for rain");
  if (req.requireWarmShoes) why.push("insulated footwear for the cold");
  if (o.some(i=>i.category==="outerwear")) why.push("one outer layer, matched to conditions");
  const accent = o.find(i=>!NEUTRALS.has(i.color));
  if (accent) why.push(`one ${accent.color} accent on a neutral base`);
  return why;
}
function recommend(pool: Item[], w: Weather, user: UserProfile, topN = 5): ScoredOutfit[] | ReturnType<typeof fallback> {
  const season = seasonOf(w);
  const feels = feelsLike(w, user);
  const bands = candidateBands(feels);
  let all: ScoredOutfit[] = [];
  const seen = new Set<string>();
  for (const band of bands) {
    const req = deriveRequirements(w, band, feels);
    const filtered = pool.filter(i => passesGate(i, req, season));
    for (const outfit of generateCandidates(filtered, req, user)) {
      const key = outfit.map(i=>i.id).sort().join("|");
      if (seen.has(key)) continue; seen.add(key);
      all.push({ outfit, score: scoreOutfit(outfit, req, w, user), why: rationale(outfit, req, feels, w.tempC) });
    }
  }
  all.sort((a,b) => b.score - a.score);
  if (!all.length) return fallback(pool, w, user, season);
  return all.slice(0, topN);
}

// ============ 6. Fallback (never invents items) ============
function fallback(all: Item[], w: Weather, user: UserProfile, season: Season) {
  const feels = feelsLike(w, user);
  const req = deriveRequirements(w, bandOf(feels), feels);
  const filtered = all.filter(i => passesGate(i, req, season));
  const has = (c: Category) => filtered.some(i => i.category === c);
  const missing: string[] = [];
  if (!has("shoes")) missing.push("weather-appropriate shoes");
  if (!has("bottoms") && !has("dresses")) missing.push("bottoms or a dress");
  if (!has("tops") && !has("dresses")) missing.push("a top or a dress");
  if (req.outerwearPolicy === "required" && !has("outerwear")) missing.push("warm/waterproof outerwear");
  if (req.requireWaterproofShoes && !filtered.some(i=>i.category==="shoes"&&i.waterproof))
    missing.push("waterproof shoes for the rain/snow");

  const bestPartial = buildSafestPartial(filtered, req, user);
  return {
    incomplete: true, missing,
    message: missing.length
      ? `Your wardrobe can't fully cover today. Missing: ${missing.join(", ")}.`
      : `No weather-perfect outfit; showing the safest available and what would improve it.`,
    suggestedAddition: suggestLayer(req),
    bestPartial,
  };
}
function buildSafestPartial(items: Item[], req: Requirements, user: UserProfile): Item[] {
  const pick = (c: Category) => topK(items.filter(i=>i.category===c), req, user, 1)[0];
  return [pick("dresses") ?? pick("tops"), pick("bottoms"), pick("shoes"), pick("outerwear")]
    .filter(Boolean) as Item[];
}
function suggestLayer(req: Requirements): string {
  if (req.requireWaterproofShoes) return "a waterproof shell + waterproof shoes would complete this";
  if (req.outerwearPolicy === "required") return "a warm coat or padded jacket would complete this";
  if (req.requireWindproofOuter) return "a windproof layer would improve this";
  return "a light layer would round this out";
}

// ============ Public API ============
export {
  recommend, feelsLike, deriveRequirements, scoreOutfit,
  steadmanAT, windChillC, vapourPressure, warmthOf, seasonOf,
};
export type { Item, Weather, UserProfile, Requirements, ScoredOutfit, Category, Season, Weight, Condition };
