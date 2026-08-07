import type { ClothingItem, OutfitItems, SavedOutfit } from "./WardrobeContext";

export type WardrobeIdMigration = {
  items: ClothingItem[];
  outfits: SavedOutfit[];
  itemIdChanges: Map<string, string>;
  outfitIdChanges: Map<string, string>;
  changed: boolean;
};

export function isCloudCompatibleId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

/**
 * Wardrobes created before account sync used timestamp-based IDs, while the
 * cloud tables require UUIDs. Re-key the local records and every saved-look
 * reference together so no photo or outfit relationship is lost.
 */
export function migrateWardrobeIds(
  items: ClothingItem[],
  outfits: SavedOutfit[],
  createId: (legacyId: string, kind: "item" | "outfit") => string,
): WardrobeIdMigration {
  const itemIdChanges = new Map<string, string>();
  const outfitIdChanges = new Map<string, string>();

  for (const item of items) {
    if (!isCloudCompatibleId(item.id)) itemIdChanges.set(item.id, createId(item.id, "item"));
  }
  for (const outfit of outfits) {
    if (!isCloudCompatibleId(outfit.id)) outfitIdChanges.set(outfit.id, createId(outfit.id, "outfit"));
  }

  if (itemIdChanges.size === 0 && outfitIdChanges.size === 0) {
    return { items, outfits, itemIdChanges, outfitIdChanges, changed: false };
  }

  const migratedItems = items.map((item) => {
    const id = itemIdChanges.get(item.id);
    return id ? { ...item, id } : item;
  });

  const migratedOutfits = outfits.map((outfit) => {
    const migratedEntries = Object.entries(outfit.items).map(([key, item]) => {
      if (!item) return [key, item] as const;
      const migratedItemId = itemIdChanges.get(item.id);
      if (!migratedItemId) return [key, item] as const;
      const migratedKey = key === `accessories:${item.id}`
        ? `accessories:${migratedItemId}`
        : key;
      return [migratedKey, { ...item, id: migratedItemId }] as const;
    });
    return {
      ...outfit,
      id: outfitIdChanges.get(outfit.id) ?? outfit.id,
      items: Object.fromEntries(migratedEntries) as OutfitItems,
    };
  });

  return {
    items: migratedItems,
    outfits: migratedOutfits,
    itemIdChanges,
    outfitIdChanges,
    changed: true,
  };
}
