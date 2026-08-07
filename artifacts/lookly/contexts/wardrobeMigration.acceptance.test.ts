import assert from "node:assert/strict";
import type { ClothingItem, SavedOutfit } from "./WardrobeContext";
import { migrateWardrobeIds } from "./wardrobeMigration";

const legacyItem: ClothingItem = {
  id: "1712345678900abcde",
  name: "Blue shirt",
  category: "tops",
  color: "Blue",
  colorHex: "#2563EB",
  seasons: ["spring"],
  fabricWeight: "light",
  isWorkwear: false,
  timesWorn: 1,
  tags: [],
  createdAt: "2026-01-01T00:00:00.000Z",
};
const legacyAccessory: ClothingItem = {
  ...legacyItem,
  id: "1712345678901fghij",
  name: "Silk scarf",
  category: "accessories",
};
const currentItem: ClothingItem = {
  ...legacyItem,
  id: "4c28567f-14a9-4c0f-9959-d367edbe47c0",
  name: "Current item",
};
const outfit: SavedOutfit = {
  id: "1712345678902klmno",
  name: "Saved look",
  items: {
    tops: legacyItem,
    [`accessories:${legacyAccessory.id}`]: legacyAccessory,
  },
  createdAt: "2026-01-02T00:00:00.000Z",
};

const generatedIds = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
];
const migrated = migrateWardrobeIds(
  [legacyItem, legacyAccessory, currentItem],
  [outfit],
  () => generatedIds.shift()!,
);

assert.equal(migrated.changed, true);
assert.equal(migrated.items[0]?.id, "11111111-1111-4111-8111-111111111111");
assert.equal(migrated.items[1]?.id, "22222222-2222-4222-8222-222222222222");
assert.equal(migrated.items[2]?.id, currentItem.id);
assert.equal(migrated.outfits[0]?.id, "33333333-3333-4333-8333-333333333333");
assert.equal(migrated.outfits[0]?.items.tops?.id, migrated.items[0]?.id);
assert.equal(
  migrated.outfits[0]?.items[`accessories:${migrated.items[1]?.id}`]?.id,
  migrated.items[1]?.id,
);

const unchanged = migrateWardrobeIds([currentItem], [], () => {
  throw new Error("A UUID should not be replaced");
});
assert.equal(unchanged.changed, false);
assert.equal(unchanged.items[0], currentItem);

console.log("wardrobe ID migration acceptance checks passed");
