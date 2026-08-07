import { removeBackground } from "@imgly/background-removal-node";
import { createCanvas, loadImage } from "canvas";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const PRODUCT_IMAGE_SIZE = 1024;
export const PRODUCT_IMAGE_PROCESSING_VERSION = 1;
const CONTENT_RATIO = 0.8;
const ALPHA_THRESHOLD = 8;
const FALLBACK_BACKGROUND = "#F9F8F6";

export interface NormalizedProductImage {
  buffer: Buffer;
  backgroundRemoved: boolean;
  imageProcessingVersion: number;
  width: number;
  height: number;
}

export type ProductImageSegmenter = (source: Buffer) => Promise<Buffer>;

const require = createRequire(import.meta.url);
const backgroundRemovalPackageDir = path.resolve(
  path.dirname(require.resolve("@imgly/background-removal-node")),
  "..",
);
const backgroundRemovalPublicPath = pathToFileURL(
  path.join(backgroundRemovalPackageDir, "dist") + path.sep,
).href;

const WARMUP_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
let modelWarmup: Promise<void> | null = null;

async function runBackgroundRemoval(source: Buffer): Promise<Buffer> {
  const blob = new Blob([new Uint8Array(source)], { type: "image/png" });
  const result = await removeBackground(blob, {
    publicPath: backgroundRemovalPublicPath,
    model: "medium",
    output: { format: "image/png", quality: 1 },
  });
  return Buffer.from(await result.arrayBuffer());
}

export function warmupProductImageNormalizer(): Promise<void> {
  if (!modelWarmup) {
    modelWarmup = runBackgroundRemoval(Buffer.from(WARMUP_PNG_BASE64, "base64"))
      .then(() => undefined)
      .catch((error: unknown) => {
        modelWarmup = null;
        throw error;
      });
  }
  return modelWarmup;
}

async function defaultSegmenter(source: Buffer): Promise<Buffer> {
  try {
    await warmupProductImageNormalizer();
  } catch {
    // The warmup sample can be rejected as empty even though a real garment
    // remains processable, so always attempt the requested image itself.
  }
  return runBackgroundRemoval(source);
}

type PixelBounds = { left: number; top: number; right: number; bottom: number };

function findAlphaBounds(data: Uint8ClampedArray, width: number, height: number): PixelBounds | null {
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3]! < ALPHA_THRESHOLD) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }
  return right >= left && bottom >= top ? { left, top, right, bottom } : null;
}

export async function normalizeTransparentForeground(source: Buffer): Promise<Buffer> {
  const image = await loadImage(source);
  const sourceCanvas = createCanvas(image.width, image.height);
  const sourceContext = sourceCanvas.getContext("2d");
  sourceContext.clearRect(0, 0, image.width, image.height);
  sourceContext.drawImage(image, 0, 0);
  const pixels = sourceContext.getImageData(0, 0, image.width, image.height);
  const bounds = findAlphaBounds(pixels.data, image.width, image.height);
  if (!bounds) throw new Error("No foreground remained after background removal");

  const foregroundWidth = bounds.right - bounds.left + 1;
  const foregroundHeight = bounds.bottom - bounds.top + 1;
  const maxContentSize = Math.round(PRODUCT_IMAGE_SIZE * CONTENT_RATIO);
  const scale = Math.min(maxContentSize / foregroundWidth, maxContentSize / foregroundHeight);
  const destinationWidth = Math.max(1, Math.round(foregroundWidth * scale));
  const destinationHeight = Math.max(1, Math.round(foregroundHeight * scale));
  const destinationX = Math.round((PRODUCT_IMAGE_SIZE - destinationWidth) / 2);
  const destinationY = Math.round((PRODUCT_IMAGE_SIZE - destinationHeight) / 2);

  const output = createCanvas(PRODUCT_IMAGE_SIZE, PRODUCT_IMAGE_SIZE);
  const outputContext = output.getContext("2d");
  outputContext.clearRect(0, 0, PRODUCT_IMAGE_SIZE, PRODUCT_IMAGE_SIZE);
  outputContext.drawImage(
    sourceCanvas,
    bounds.left,
    bounds.top,
    foregroundWidth,
    foregroundHeight,
    destinationX,
    destinationY,
    destinationWidth,
    destinationHeight,
  );
  return output.toBuffer("image/png");
}

export async function normalizeStudioFallback(source: Buffer): Promise<Buffer> {
  const image = await loadImage(source);
  const output = createCanvas(PRODUCT_IMAGE_SIZE, PRODUCT_IMAGE_SIZE);
  const context = output.getContext("2d");
  context.fillStyle = FALLBACK_BACKGROUND;
  context.fillRect(0, 0, PRODUCT_IMAGE_SIZE, PRODUCT_IMAGE_SIZE);
  const scale = Math.min(PRODUCT_IMAGE_SIZE / image.width, PRODUCT_IMAGE_SIZE / image.height);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  context.drawImage(
    image,
    Math.round((PRODUCT_IMAGE_SIZE - width) / 2),
    Math.round((PRODUCT_IMAGE_SIZE - height) / 2),
    width,
    height,
  );
  return output.toBuffer("image/png");
}

export async function normalizeProductImage(
  source: Buffer,
  segmenter: ProductImageSegmenter = defaultSegmenter,
): Promise<NormalizedProductImage> {
  try {
    const transparent = await segmenter(source);
    return {
      buffer: await normalizeTransparentForeground(transparent),
      backgroundRemoved: true,
      imageProcessingVersion: PRODUCT_IMAGE_PROCESSING_VERSION,
      width: PRODUCT_IMAGE_SIZE,
      height: PRODUCT_IMAGE_SIZE,
    };
  } catch {
    return {
      buffer: await normalizeStudioFallback(source),
      backgroundRemoved: false,
      imageProcessingVersion: 0,
      width: PRODUCT_IMAGE_SIZE,
      height: PRODUCT_IMAGE_SIZE,
    };
  }
}
