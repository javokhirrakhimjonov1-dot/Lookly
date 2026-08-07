import { Router } from "express";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { editImageFromBase64, geminiChatWithImage } from "@workspace/integrations-gemini-ai-server";
import {
  normalizeProductImage,
  normalizeStudioFallback,
  PRODUCT_IMAGE_PROCESSING_VERSION,
  PRODUCT_IMAGE_SIZE,
} from "../lib/productImageNormalization";
import {
  getCatalogIsolationReviewPrompt,
  getCatalogImagePolicy,
  isolationReviewPassed,
} from "../lib/catalogImagePolicy";

const router = Router();
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.resolve(import.meta.dirname, "../../../uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

function cleanBase64(value: string): string {
  return value.includes(",") ? (value.split(",")[1] ?? "") : value;
}

function saveNormalizedImage(result: Awaited<ReturnType<typeof normalizeProductImage>>) {
  const filename = `${crypto.randomUUID()}.png`;
  fs.writeFileSync(path.join(UPLOADS_DIR, filename), result.buffer);
  return {
    image: result.buffer.toString("base64"),
    mimeType: "image/png",
    url: `/uploads/${filename}`,
    backgroundRemoved: result.backgroundRemoved,
    imageProcessingVersion: result.imageProcessingVersion,
    width: result.width,
    height: result.height,
  };
}

router.post("/normalize-product-image", async (req, res) => {
  const { photoBase64 } = req.body as { photoBase64?: string; mimeType?: string };
  if (!photoBase64) {
    res.status(400).json({ error: "photoBase64 is required" });
    return;
  }
  try {
    const normalized = await normalizeProductImage(Buffer.from(cleanBase64(photoBase64), "base64"));
    res.json(saveNormalizedImage(normalized));
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: detail || "Product image normalization failed" });
  }
});

router.post("/remove-bg", async (req, res) => {
  const { photoBase64, mimeType = "image/jpeg", itemName, category, colorName, material, tags, brandLogo, locationHint } = req.body as {
    photoBase64?: string;
    mimeType?: string;
    itemName?: string;
    category?: string;
    colorName?: string;
    material?: string;
    tags?: string[];
    brandLogo?: { brand?: string; description?: string } | null;
    locationHint?: string;
  };

  if (!photoBase64) {
    res.status(400).json({ error: "photoBase64 is required" });
    return;
  }

  try {
    const raw = cleanBase64(photoBase64);
    const policy = getCatalogImagePolicy({ category, itemName, material, tags });
    const prompt = [
      `Transform the exact ${itemName ?? category ?? "clothing item"} in the reference into one premium, ultra-high-resolution e-commerce product catalog photograph.`,
      "Match the reference as strictly as possible: preserve the exact silhouette, cut, proportions, color, material, texture, seams, closures, straps or sleeves, pattern, and every visible design detail. Do not substitute the product for a similar-looking item.",
      `The detected color is ${colorName ?? "the original color"}; the material is ${material ?? "the original material"}. Do not recolor, simplify, redesign, add, remove, or invent details.`,
      "Re-render it as an ultra-sharp 8K-quality retail asset: no blur, camera noise, pixelation, glare, muddy gradients, harsh shadows, or phone-camera artifacts. Use bright, clean, diffused professional studio lighting and natural, premium material detail.",
      "Make fabric look pristine, freshly steamed, ironed, lint-free, and wrinkle-free while preserving the garment's true construction. Leather should look smooth and high quality; cotton and knits should have clean, realistic texture.",
      brandLogo?.brand ? `Preserve the visible ${brandLogo.brand} mark exactly, in its real position and scale; do not invent extra branding.` : "Do not add any logo or branding not visible in the reference.",
      locationHint ? `The requested product is specifically positioned as: ${locationHint}. Use that location only to identify the correct product in the source; do not preserve the source pose, angle, or surroundings.` : "",
      policy.compositionRule,
      "CRITICAL OUTPUT RULE: return ONLY one isolated catalog product; the required matching pair of footwear counts as one product. Never show a model wearing it. If the source includes a mirror, person, selfie, hand, face, body, room, hanger, or other clothing, remove all of that completely and render only the named product.",
      "If multiple products appear in the source, render ONLY the named product according to the composition rule above. Keep it perfectly centered, upright, fully visible, and symmetrical. The product must occupy about 70% of the canvas and have generous even margins: no cropping at any edge.",
      "Use a completely solid, flat, clean warm off-white background with no shadow, gradient, floor line, texture, or reflection. No person, hands, face, body, hanger, room, labels, collage, unintended duplicate, mismatched shoe, or extra accessory. The final result must look ready for a premium fashion webshop catalog and easy to isolate from its background.",
    ].join(" ");
    let generated = await editImageFromBase64(raw, mimeType, prompt, "1024x1024");
    let isolationPassed = false;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (!generated.length) throw new Error("Gemini returned no catalog image");
      const review = await geminiChatWithImage({
        imageBase64: generated.toString("base64"),
        mimeType: "image/png",
        text: getCatalogIsolationReviewPrompt({
          itemName,
          category,
          reviewRule: policy.reviewRule,
        }),
        maxOutputTokens: 160,
        responseMimeType: "application/json",
      });
      isolationPassed = isolationReviewPassed(review);
      if (isolationPassed) break;
      if (attempt === 0) {
        generated = await editImageFromBase64(
          raw,
          mimeType,
          `${prompt} ABSOLUTE CORRECTION: a previous attempt failed catalog quality review because it included a wearer, body part, mannequin, support, or an incomplete product. Remove every non-product object completely and restore every real structural part of the named product. Render only one complete detached product against the empty background. For a watch, there must be no wrist, hand, arm, skin, or display limb anywhere in the image. For eyewear, both lenses and the complete connecting frame, bridge, hinges, and temples must be intact. For a hoodie, there must be no neck or torso form inside it and no mannequin extending below it.`,
          "1024x1024",
        );
      }
    }
    if (!isolationPassed) {
      throw new Error("Catalog image failed quality review because it contained a wearer, mannequin, support, or an incomplete product");
    }
    const normalized = policy.preserveStudioBackground
      ? {
          buffer: await normalizeStudioFallback(generated),
          backgroundRemoved: false,
          imageProcessingVersion: PRODUCT_IMAGE_PROCESSING_VERSION,
          width: PRODUCT_IMAGE_SIZE,
          height: PRODUCT_IMAGE_SIZE,
        }
      : await normalizeProductImage(generated);
    const saved = saveNormalizedImage(normalized);
    res.json({
      ...saved,
      // Category-specific versions let older assets be regenerated without
      // touching unrelated wardrobe items.
      imageProcessingVersion: policy.processingVersion
        ? Math.max(saved.imageProcessingVersion, policy.processingVersion)
        : saved.imageProcessingVersion,
      studioGenerated: true,
    });
    return;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg || "Background removal failed" });
  }
});

export default router;
