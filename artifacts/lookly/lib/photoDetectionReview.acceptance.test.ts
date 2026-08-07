import assert from "node:assert/strict";
import { groupDetectionsByPhoto, type PhotoTaggedDetection } from "./photoDetectionReview";

const firstPhoto = "data:image/jpeg;base64,first";
const secondPhoto = "data:image/jpeg;base64,second";
const groups = groupDetectionsByPhoto([
  { name: "sunglasses", _photoIndex: 1, _photoTotal: 2, _photoUri: secondPhoto },
  { name: "dress", _photoIndex: 0, _photoTotal: 2, _photoUri: firstPhoto },
  { name: "smart band", _photoIndex: 1, _photoTotal: 2, _photoUri: secondPhoto },
], firstPhoto);

assert.equal(groups.length, 2);
assert.deepEqual(groups.map((group) => group.photoIndex), [0, 1]);
assert.equal(groups[0]?.imageUri, firstPhoto);
assert.deepEqual(groups[0]?.items.map((item) => item.name), ["dress"]);
assert.equal(groups[1]?.imageUri, secondPhoto);
assert.deepEqual(groups[1]?.items.map((item) => item.name), ["sunglasses", "smart band"]);
assert.equal(groups[1]?.photoTotal, 2);

const legacyGroup = groupDetectionsByPhoto<PhotoTaggedDetection & { name: string }>(
  [{ name: "shirt" }],
  "fallback-photo",
);
assert.equal(legacyGroup[0]?.photoIndex, 0);
assert.equal(legacyGroup[0]?.photoTotal, 1);
assert.equal(legacyGroup[0]?.imageUri, "fallback-photo");

console.log("photo detection review acceptance tests passed");
