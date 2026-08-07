const VALID_CATEGORIES = new Set(["tops", "bottoms", "dresses", "outerwear", "shoes", "socks", "accessories"]);

export function normalizeCategory(category: unknown, name: unknown, tags: unknown): string {
  const raw = typeof category === "string" ? category.trim().toLowerCase() : "";
  const searchable = `${raw} ${typeof name === "string" ? name : ""} ${Array.isArray(tags) ? tags.join(" ") : ""}`.toLowerCase();
  if (/\b(sock|socks|hosiery|tights|stocking|stockings)\b/.test(searchable)) return "socks";
  if (/\b(skirts?|trousers?|pants|jeans|shorts|culottes|leggings)\b/.test(searchable)) return "bottoms";
  if (/\b(dresses|dress|jumpsuits?|rompers?)\b/.test(searchable)) return "dresses";
  if (/\b(blouses?|bodysuits?|shirts?|tops?|tees?|t-shirts?|camisoles?|tunics?)\b/.test(searchable)) return "tops";
  if (/\b(heels?|pumps?|loafers?|boots?|sandals?|sneakers?|shoes?|ballet flats?)\b/.test(searchable)) return "shoes";
  if (/\b(handbag|purse|bag|jewellery|jewelry|necklace|bracelet|earrings?|hijab|headscarf|scarf|belt|hat)\b/.test(searchable)) return "accessories";
  return VALID_CATEGORIES.has(raw) ? raw : "tops";
}

export function isUnsupportedSpecialistItem(name: unknown, tags: unknown, itemType: unknown): boolean {
  const text = `${name ?? ""} ${Array.isArray(tags) ? tags.join(" ") : ""} ${itemType ?? ""}`.toLowerCase();
  return /\b(?:bra|bralette|lingerie|underwear|panties|swimwear|swimsuit|bikini|maternity)\b/.test(text);
}
