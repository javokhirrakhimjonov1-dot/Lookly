import type { Category, Item, Season, Weight } from "../engine/weatherEngine";

export interface StoredWardrobeItem { id: string; name: string; category: string; color?: string; colorHex?: string; seasons?: string[]; fabricWeight?: string; tags?: string[]; material?: string; timesWorn?: number; lastWornDaysAgo?: number; wearCount?: number; isWorkwear?: boolean; waterproof?: boolean; windproof?: boolean; warm?: boolean; fit?: Item["fit"]; }
const categories = new Set<Category>(["tops","bottoms","dresses","outerwear","shoes","socks","accessories"]);
const seasons = new Set<Season>(["spring","summer","fall","winter"]);
const weights = new Set<Weight>(["light","medium","heavy"]);
const neutrals = new Set(["black","white","grey","gray","beige","navy","brown","cream","olive","tan"]);
const norm = (value: unknown, fallback = "") => typeof value === "string" ? value.trim().toLowerCase() : fallback;

/** Computes hue in the data layer. Neutrals deliberately have no hue. */
export function hueFromHex(hex: unknown, color?: unknown): number | undefined {
  if (neutrals.has(norm(color))) return undefined;
  const value = typeof hex === "string" ? hex.trim().replace(/^#/, "") : "";
  if (!/^[0-9a-f]{6}$/i.test(value)) return undefined;
  const [r,g,b] = [0,2,4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255);
  const max = Math.max(r,g,b), min = Math.min(r,g,b), delta = max - min;
  if (!delta) return undefined;
  const hue = max === r ? ((g-b)/delta)%6 : max === g ? (b-r)/delta+2 : (r-g)/delta+4;
  return Math.round((hue * 60 + 360) % 360);
}
function material(value: unknown, searchable: string): string | undefined {
  const source = `${norm(value)} ${searchable}`;
  for (const key of ["suede","linen","wool","denim","leather","canvas","mesh","cotton","technical"]) if (source.includes(key)) return key;
  if (/nylon|polyester|synthetic/.test(source)) return "synthetic";
  return undefined;
}
function inferred(item: StoredWardrobeItem, key: "waterproof"|"windproof"|"warm", source: string) {
  if (item[key]) return true;
  const terms = { waterproof:["waterproof","water resistant","rain","gore-tex"], windproof:["windproof","wind resistant","shell"], warm:["warm","insulated","puffer","fleece","thermal","wool","lined"] };
  return terms[key].some((term) => source.includes(term));
}
export function mapWardrobeItem(item: StoredWardrobeItem): Item | null {
  const category = norm(item.category) as Category;
  if (!item.id || !item.name || !categories.has(category)) return null;
  const tags = Array.isArray(item.tags) ? item.tags.map((tag) => norm(tag)).filter(Boolean) : [];
  if (item.isWorkwear && !tags.includes("workwear")) tags.push("workwear");
  const source = `${item.name} ${tags.join(" ")} ${item.material ?? ""}`.toLowerCase();
  const color = norm(item.color, "black") || "black";
  const candidateWeight = norm(item.fabricWeight, "medium") as Weight;
  return { id:item.id, name:item.name, category, color, hue:hueFromHex(item.colorHex,color), seasons:(Array.isArray(item.seasons)?item.seasons:[]).map((x)=>norm(x) as Season).filter((x): x is Season => seasons.has(x)), weight:weights.has(candidateWeight)?candidateWeight:"medium", tags, material:material(item.material,source), waterproof:inferred(item,"waterproof",source), windproof:inferred(item,"windproof",source), warm:inferred(item,"warm",source), fit:item.fit, lastWornDaysAgo:Number.isFinite(item.lastWornDaysAgo)?item.lastWornDaysAgo:30, wearCount:Number.isFinite(item.wearCount)?item.wearCount:(item.timesWorn??0) };
}
export const mapWardrobe = (items: StoredWardrobeItem[]): Item[] => items.map(mapWardrobeItem).filter((item): item is Item => item !== null);
