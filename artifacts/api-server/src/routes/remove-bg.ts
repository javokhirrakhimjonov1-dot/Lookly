import { Router } from "express";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { removeBackground } from "@imgly/background-removal-node";
import { editImageFromBase64 } from "@workspace/integrations-gemini-ai-server";

const router = Router();

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.resolve(import.meta.dirname, "../../../uploads");
// pnpm keeps this dependency below the API package, while the library's
// default path assumes a flat root node_modules directory.
const require = createRequire(import.meta.url);
const backgroundRemovalPackageDir = path.resolve(
  path.dirname(require.resolve("@imgly/background-removal-node")),
  "..",
);
const BACKGROUND_REMOVAL_PUBLIC_PATH = pathToFileURL(
  path.join(backgroundRemovalPackageDir, "dist") + path.sep,
).href;
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

router.post("/remove-bg", async (req, res) => {
  const { photoBase64, mimeType = "image/jpeg", itemName, category, colorName, material, brandLogo } = req.body as {
    photoBase64?: string;
    mimeType?: string;
    itemName?: string;
    category?: string;
    colorName?: string;
    material?: string;
    brandLogo?: { brand?: string; description?: string } | null;
  };

  if (!photoBase64) {
    res.status(400).json({ error: "photoBase64 is required" });
    return;
  }

  try {
    const raw = photoBase64.includes(",") ? photoBase64.split(",")[1] : photoBase64;
    const inputBuffer = Buffer.from(raw, "base64");
    try {
      const prompt = [
        `Transform the exact ${itemName ?? category ?? "clothing item"} in the reference into one premium, ultra-high-resolution e-commerce product catalog photograph.`,
        "Match the reference as strictly as possible: preserve the exact silhouette, cut, proportions, color, material, texture, seams, closures, straps or sleeves, pattern, and every visible design detail. Do not substitute the product for a similar-looking item.",
        `The detected color is ${colorName ?? "the original color"}; the material is ${material ?? "the original material"}. Do not recolor, simplify, redesign, add, remove, or invent details.`,
        "Re-render it as an ultra-sharp 8K-quality retail asset: no blur, camera noise, pixelation, glare, muddy gradients, harsh shadows, or phone-camera artifacts. Use bright, clean, diffused professional studio lighting and natural, premium material detail.",
        "Make fabric look pristine, freshly steamed, ironed, lint-free, and wrinkle-free while preserving the garment's true construction. Leather should look smooth and high quality; cotton and knits should have clean, realistic texture.",
        brandLogo?.brand ? `Preserve the visible ${brandLogo.brand} mark exactly, in its real position and scale; do not invent extra branding.` : "Do not add any logo or branding not visible in the reference.",
        "If multiple items appear, render ONLY the named item. Present it as a perfectly centered, upright, fully visible, symmetrical studio flat-lay or clean front-facing stock photo. Leave generous even margins: no cropping at any edge.",
        "Use a completely solid, clean, isolated warm off-white background with a subtle natural contact shadow only. No person, hands, hanger, room, labels, collage, duplicate item, or extra accessory.",
      ].join(" ");
      const generated = await editImageFromBase64(raw, mimeType, prompt, "1024x1024");
      if (generated.length > 0) {
        const filename = `${crypto.randomUUID()}.png`;
        fs.writeFileSync(path.join(UPLOADS_DIR, filename), generated);
        res.json({
          image: generated.toString("base64"),
          mimeType: "image/png",
          url: `/uploads/${filename}`,
          studioGenerated: true,
        });
        return;
      }
      throw new Error("Gemini returned no catalog image");
    } catch (studioError: unknown) {
      // A generic local segmenter often cuts out the person from a mirror
      // image instead of the garment. Return it only as a diagnostic fallback
      // so clients never mistake it for a finished catalog product image.
      try {
        const inputBlob = new Blob([inputBuffer], { type: mimeType });
        const resultBlob = await removeBackground(inputBlob as any, {
          publicPath: BACKGROUND_REMOVAL_PUBLIC_PATH,
          model: "medium",
          output: { format: "image/png", quality: 0.8 },
        });
        const cutoutBuffer = Buffer.from(await resultBlob.arrayBuffer());
        const filename = `${crypto.randomUUID()}.png`;
        fs.writeFileSync(path.join(UPLOADS_DIR, filename), cutoutBuffer);
        res.status(202).json({
          image: cutoutBuffer.toString("base64"),
          mimeType: "image/png",
          url: `/uploads/${filename}`,
          studioGenerated: false,
          error: studioError instanceof Error ? studioError.message : "Studio image generation unavailable",
        });
        return;
      } catch {
        throw studioError;
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg || "Background removal failed" });
  }
});

export default router;
