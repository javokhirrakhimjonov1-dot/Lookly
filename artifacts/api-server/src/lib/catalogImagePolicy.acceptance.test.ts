import assert from "node:assert/strict";
import {
  getCatalogImagePolicy,
  EYEWEAR_CATALOG_PROCESSING_VERSION,
  HOODIE_CATALOG_PROCESSING_VERSION,
  isolationReviewPassed,
  WATCH_CATALOG_PROCESSING_VERSION,
} from "./catalogImagePolicy";

const watch = getCatalogImagePolicy({
  category: "accessories",
  itemName: "Black smart watch",
  material: "metal and silicone",
  tags: ["sporty", "tech"],
});
assert.equal(watch.processingVersion, WATCH_CATALOG_PROCESSING_VERSION);
assert.match(watch.compositionRule, /detached, unworn/i);
assert.match(watch.compositionRule, /no wrist, arm, hand|NEVER show any wrist, arm, hand/i);
assert.match(watch.compositionRule, /only foreground object may be the watch/i);

const accessory = getCatalogImagePolicy({ category: "accessories", itemName: "Silver bracelet" });
assert.match(accessory.compositionRule, /standalone retail product/i);
assert.match(accessory.compositionRule, /do not show or imply a wearer/i);

const top = getCatalogImagePolicy({ category: "tops", itemName: "White cotton shirt" });
assert.match(top.compositionRule, /completely detached and unworn/i);

const sunglasses = getCatalogImagePolicy({ category: "accessories", itemName: "White frame cat-eye sunglasses" });
assert.equal(sunglasses.processingVersion, EYEWEAR_CATALOG_PROCESSING_VERSION);
assert.equal(sunglasses.preserveStudioBackground, true);
assert.match(sunglasses.compositionRule, /bridge connecting them/i);
assert.match(sunglasses.reviewRule ?? "", /loose lenses/i);

const hoodie = getCatalogImagePolicy({ category: "outerwear", itemName: "Black zip-up hoodie" });
assert.equal(hoodie.processingVersion, HOODIE_CATALOG_PROCESSING_VERSION);
assert.match(hoodie.compositionRule, /no neck form inside/i);
assert.match(hoodie.reviewRule ?? "", /below the hem/i);

assert.equal(isolationReviewPassed('{"isolatedProductOnly":true,"hasHumanBodyPart":false,"hasMannequinOrSupport":false,"productComplete":true}'), true);
assert.equal(isolationReviewPassed('{"isolatedProductOnly":true,"hasHumanBodyPart":true,"hasMannequinOrSupport":false,"productComplete":true}'), false);
assert.equal(isolationReviewPassed('{"isolatedProductOnly":true,"hasHumanBodyPart":false,"hasMannequinOrSupport":true,"productComplete":true}'), false);
assert.equal(isolationReviewPassed('{"isolatedProductOnly":true,"hasHumanBodyPart":false,"hasMannequinOrSupport":false,"productComplete":false}'), false);
assert.equal(isolationReviewPassed("not valid JSON"), false);

console.log("Catalog image isolation policy acceptance checks passed");
