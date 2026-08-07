import assert from "node:assert/strict";
import { getGarmentTone } from "./garmentTone";

for (const color of ["#000000", "#FFFFFF", "#800020", "#6B7C4D", "#ABC", "invalid", undefined]) {
  const tone = getGarmentTone(color);
  for (const value of Object.values(tone)) assert.match(value, /^#[0-9A-F]{6}$/);
  assert.notEqual(tone.background, tone.garment, "the card must use a soft tint, not the full garment color");
}

const black = getGarmentTone("#000000");
assert.equal(black.background, "#DBDAD8");
assert.notEqual(black.border, black.background);
const white = getGarmentTone("#FFFFFF");
assert.equal(white.border, "#E8E2DA", "near-white garments must retain the theme border");
assert.equal(getGarmentTone("not-a-color").garment, "#C8906A");

console.log("Garment tone acceptance checks passed");
