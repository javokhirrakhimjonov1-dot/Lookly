import { Router } from "express";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { editImageFromBase64 } from "@workspace/integrations-gemini-ai-server";

const router = Router();

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.resolve(import.meta.dirname, "../../../uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

router.post("/remove-bg", async (req, res) => {
  const { photoBase64, mimeType = "image/jpeg", itemName, category, colorName, material, brandLogo, locationHint } = req.body as {
    photoBase64?: string;
    mimeType?: string;
    itemName?: string;
    category?: string;
    colorName?: string;
    material?: string;
    brandLogo?: { brand?: string; description?: string } | null;
    locationHint?: string;
  };

  if (!photoBase64) {
    res.status(400).json({ error: "photoBase64 is required" });
    return;
  }

  try {
    const raw = photoBase64.includes(",") ? photoBase64.split(",")[1] : photoBase64;
    const prompt = [
      `Transform the exact ${itemName ?? category ?? "clothing item"} in the reference into one premium, ultra-high-resolution e-commerce product catalog photograph.`,
      "Match the reference as strictly as possible: preserve the exact silhouette, cut, proportions, color, material, texture, seams, closures, straps or sleeves, pattern, and every visible design detail. Do not substitute the product for a similar-looking item.",
      `The detected color is ${colorName ?? "the original color"}; the material is ${material ?? "the original material"}. Do not recolor, simplify, redesign, add, remove, or invent details.`,
      "Re-render it as an ultra-sharp 8K-quality retail asset: no blur, camera noise, pixelation, glare, muddy gradients, harsh shadows, or phone-camera artifacts. Use bright, clean, diffused professional studio lighting and natural, premium material detail.",
      "Make fabric look pristine, freshly steamed, ironed, lint-free, and wrinkle-free while preserving the garment's true construction. Leather should look smooth and high quality; cotton and knits should have clean, realistic texture.",
      brandLogo?.brand ? `Preserve the visible ${brandLogo.brand} mark exactly, in its real position and scale; do not invent extra branding.` : "Do not add any logo or branding not visible in the reference.",
      locationHint ? `The requested item is specifically positioned as: ${locationHint}. Keep only that single item; do not return a second matching shoe, garment, or any person.` : "",
      "CRITICAL OUTPUT RULE: return ONLY one isolated product, never a model wearing it. If the source includes a mirror, person, selfie, hand, face, body, room, hanger, or other clothing, remove all of that completely and render only the named item.",
      "If multiple items appear, render ONLY the named item. Present it as a perfectly centered, upright, fully visible, symmetrical studio flat-lay or clean front-facing stock photo. The product must occupy about 70% of the canvas and have generous even margins: no cropping at any edge.",
      "Use a completely solid, clean, isolated warm off-white background with a subtle natural contact shadow only. No person, hands, face, body, hanger, room, labels, collage, duplicate item, or extra accessory. The final result must look ready for a premium fashion webshop catalog.",
    ].join(" ");
    const generated = await editImageFromBase64(raw, mimeType, prompt, "1024x1024");
    if (!generated.length) {
      throw new Error("Gemini returned no catalog image");
    }
    const filename = `${crypto.randomUUID()}.png`;
    fs.writeFileSync(path.join(UPLOADS_DIR, filename), generated);
    res.json({
      image: generated.toString("base64"),
      mimeType: "image/png",
      url: `/uploads/${filename}`,
      studioGenerated: true,
    });
    return;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg || "Background removal failed" });
  }
});

export default router;
