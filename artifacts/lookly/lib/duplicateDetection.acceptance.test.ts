import assert from "node:assert/strict";
import {
  defaultDuplicateSelection,
  duplicateMetadataScore,
  isHighConfidenceMetadataDuplicate,
  isNearIdenticalDescriptionDuplicate,
  shortlistDuplicateCandidates,
} from "./duplicateDetection";
import type { DuplicateComparable } from "./duplicateDetection";

const oliveShirt: DuplicateComparable = {
  name: "Olive green linen button-down shirt",
  category: "tops",
  color: "Olive",
  colorHex: "#6B7C4D",
  fabricWeight: "light",
  tags: ["casual", "minimal"],
  visualSignature: {
    itemType: "button-down shirt",
    shape: "regular straight cut",
    pattern: "solid",
    materialFamily: "linen",
    closures: ["front buttons"],
    sleeve: "long sleeve",
    collar: "spread collar",
    features: ["single chest pocket", "white buttons", "rolled cuffs"],
  },
};

const sameOliveShirt: DuplicateComparable = {
  ...oliveShirt,
  id: "same-shirt",
  name: "Olive linen long-sleeve buttondown",
};

const differentOliveShirt: DuplicateComparable = {
  ...oliveShirt,
  id: "different-shirt",
  name: "Olive striped short sleeve shirt",
  visualSignature: {
    ...oliveShirt.visualSignature!,
    pattern: "striped",
    sleeve: "short sleeve",
    features: ["two chest pockets", "dark buttons"],
  },
};

const digitalWatch: DuplicateComparable = {
  name: "Burgundy digital wristwatch",
  category: "accessories",
  color: "Burgundy",
  colorHex: "#800020",
  fabricWeight: "medium",
  tags: ["digital", "casual"],
  visualSignature: {
    itemType: "digital wristwatch",
    shape: "rectangular face",
    pattern: "solid",
    materialFamily: "resin",
    closures: ["buckle"],
    sleeve: "not-applicable",
    collar: "not-applicable",
    features: ["rectangular digital display"],
  },
};

const analogWatch: DuplicateComparable = {
  ...digitalWatch,
  id: "analog-watch",
  name: "Burgundy analog wristwatch",
  visualSignature: {
    ...digitalWatch.visualSignature!,
    itemType: "analog wristwatch",
    shape: "round face",
    features: ["round analog face"],
  },
};

assert.equal(isHighConfidenceMetadataDuplicate(duplicateMetadataScore(oliveShirt, sameOliveShirt)), true);
assert.equal(duplicateMetadataScore(oliveShirt, differentOliveShirt).score, 0);
assert.equal(duplicateMetadataScore(digitalWatch, analogWatch).score, 0);
assert.deepEqual(shortlistDuplicateCandidates(oliveShirt, [differentOliveShirt, sameOliveShirt]).map((match) => match.item.id), ["same-shirt"]);
assert.deepEqual([...defaultDuplicateSelection([{}, { _isDuplicate: true }, {}])], [0, 2]);

const genericBlackTee: DuplicateComparable = {
  name: "Plain black cotton t-shirt",
  category: "tops",
  color: "Black",
  colorHex: "#1C1512",
  fabricWeight: "light",
  tags: ["casual", "minimal"],
};
const anotherBlackTee: DuplicateComparable = {
  ...genericBlackTee,
  id: "another-black-tee",
  name: "Black casual crew-neck tee",
};
assert.equal(isHighConfidenceMetadataDuplicate(duplicateMetadataScore(genericBlackTee, anotherBlackTee)), false);

const legacyOliveShirt: DuplicateComparable = {
  ...oliveShirt,
  id: "legacy-shirt",
  visualSignature: undefined,
};
assert.equal(shortlistDuplicateCandidates({ ...oliveShirt, visualSignature: undefined }, [legacyOliveShirt]).length, 1);

const firstTexturedPolo: DuplicateComparable = {
  name: "Black long-sleeve textured polo shirt",
  category: "tops",
  color: "Black",
  colorHex: "#1C1512",
  fabricWeight: "medium",
  tags: ["casual", "textured"],
};
const reorderedTexturedPolo: DuplicateComparable = {
  ...firstTexturedPolo,
  id: "same-polo",
  name: "Black textured long-sleeve polo shirt",
};
const poloCandidate = shortlistDuplicateCandidates(firstTexturedPolo, [reorderedTexturedPolo])[0]!;
assert.equal(isNearIdenticalDescriptionDuplicate(firstTexturedPolo, poloCandidate), true);
assert.equal(isNearIdenticalDescriptionDuplicate(digitalWatch, duplicateMetadataScore(digitalWatch, analogWatch)), false);

const firstBlackSmartwatch: DuplicateComparable = {
  name: "Black smartwatch",
  category: "accessories",
  color: "Black",
  colorHex: "#1C1512",
  fabricWeight: "medium",
  tags: ["casual", "sporty"],
  visualSignature: {
    itemType: "smart watch",
    shape: "rectangular face",
    pattern: "solid",
    materialFamily: "synthetic",
    closures: ["buckle"],
    sleeve: "not-applicable",
    collar: "not-applicable",
    features: ["black rectangular display", "black silicone strap"],
  },
};
const secondBlackSmartwatch: DuplicateComparable = {
  ...firstBlackSmartwatch,
  id: "same-black-smartwatch",
  name: "Black smart watch",
};
const smartwatchCandidate = duplicateMetadataScore(firstBlackSmartwatch, secondBlackSmartwatch);
assert.equal(isHighConfidenceMetadataDuplicate(smartwatchCandidate), true);
assert.deepEqual(
  shortlistDuplicateCandidates(firstBlackSmartwatch, [secondBlackSmartwatch]).map((match) => match.item.id),
  ["same-black-smartwatch"],
);

console.log("duplicate detection acceptance tests passed");
