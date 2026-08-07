import assert from "node:assert/strict";
import { createCanvas, loadImage } from "canvas";
import {
  normalizeProductImage,
  PRODUCT_IMAGE_PROCESSING_VERSION,
  PRODUCT_IMAGE_SIZE,
} from "./productImageNormalization";

function transparentFixture(width: number, height: number, color: string): Buffer {
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, width, height);
  context.fillStyle = color;
  context.fillRect(0, 0, width, height);
  return canvas.toBuffer("image/png");
}

async function alphaBounds(buffer: Buffer) {
  const image = await loadImage(buffer);
  const canvas = createCanvas(image.width, image.height);
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0);
  const data = context.getImageData(0, 0, image.width, image.height).data;
  let left = image.width, top = image.height, right = -1, bottom = -1;
  for (let y = 0; y < image.height; y += 1) for (let x = 0; x < image.width; x += 1) {
    if (data[(y * image.width + x) * 4 + 3]! < 8) continue;
    left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  return { width: right - left + 1, height: bottom - top + 1, left, top, right, bottom };
}

for (const fixture of [
  transparentFixture(200, 600, "#ffffff"),
  transparentFixture(700, 180, "#000000"),
  transparentFixture(320, 320, "#c8906a"),
]) {
  const result = await normalizeProductImage(fixture, async () => fixture);
  assert.equal(result.backgroundRemoved, true);
  assert.equal(result.imageProcessingVersion, PRODUCT_IMAGE_PROCESSING_VERSION);
  assert.equal(result.width, PRODUCT_IMAGE_SIZE);
  assert.equal(result.height, PRODUCT_IMAGE_SIZE);
  const image = await loadImage(result.buffer);
  assert.equal(image.width, PRODUCT_IMAGE_SIZE);
  assert.equal(image.height, PRODUCT_IMAGE_SIZE);
  const bounds = await alphaBounds(result.buffer);
  assert(Math.max(bounds.width, bounds.height) >= 818 && Math.max(bounds.width, bounds.height) <= 820);
  assert(Math.abs(bounds.left - (PRODUCT_IMAGE_SIZE - 1 - bounds.right)) <= 1);
  assert(Math.abs(bounds.top - (PRODUCT_IMAGE_SIZE - 1 - bounds.bottom)) <= 1);
}

const studio = createCanvas(640, 360);
const studioContext = studio.getContext("2d");
studioContext.fillStyle = "#345678";
studioContext.fillRect(0, 0, 640, 360);
const fallback = await normalizeProductImage(studio.toBuffer("image/png"), async () => {
  throw new Error("segmenter unavailable");
});
assert.equal(fallback.backgroundRemoved, false);
assert.equal(fallback.imageProcessingVersion, 0);
const fallbackImage = await loadImage(fallback.buffer);
assert.equal(fallbackImage.width, PRODUCT_IMAGE_SIZE);
assert.equal(fallbackImage.height, PRODUCT_IMAGE_SIZE);

console.log("Product image normalization acceptance checks passed");
