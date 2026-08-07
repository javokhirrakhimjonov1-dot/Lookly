import assert from "node:assert/strict";
import {
  getShopSuggestionType,
  isVerifiedModestShopType,
  shopSuggestionTypeLabel,
} from "./shopSuggestionPreferences";

assert.equal(getShopSuggestionType("Women's cotton T-shirt"), "t-shirt");
assert.equal(getShopSuggestionType("Women's long-sleeve top"), "long-sleeve-top");
assert.equal(getShopSuggestionType("Women's relaxed trousers"), "trousers");
assert.equal(getShopSuggestionType("Everyday open-toe sandals"), "sandals");

assert.equal(isVerifiedModestShopType("long-sleeve-top", "tops"), true);
assert.equal(isVerifiedModestShopType("trousers", "bottoms"), true);
assert.equal(isVerifiedModestShopType("shorts", "bottoms"), false);
assert.equal(isVerifiedModestShopType("t-shirt", "tops"), false);
assert.equal(isVerifiedModestShopType("sandals", "shoes"), true);

assert.equal(shopSuggestionTypeLabel("long-sleeve-top"), "Long-sleeve tops");

console.log("Shop suggestion preference acceptance checks passed");
