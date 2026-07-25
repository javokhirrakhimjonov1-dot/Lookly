import { Router } from "express";
import {
  generateImageBuffer,
  generateImageFromReferences,
} from "@workspace/integrations-gemini-ai-server";

const router = Router();

type Item = {
  name: string;
  color: string;
  colorHex: string;
  category: string;
};

type ReferenceImage = {
  imageBase64: string;
  imageMime?: string;
  label?: string;
};

function cleanBase64(value?: string): string | undefined {
  if (!value) return undefined;
  return value.includes(",") ? value.split(",")[1] : value;
}

function makePreviewPrompt(
  items: Item[],
  weather: string,
  temperature: number,
  mood: string,
  hasBodyReference: boolean,
  referenceCount: number,
): string {
  const garments = items.map((item, index) =>
    `${index + 1}. ${item.name} — ${item.category}, ${item.color} (${item.colorHex})`,
  ).join("\n");
  const personInstruction = hasBodyReference
    ? "The first reference image is the user-provided full-body fitting reference. Keep that person's visible skin tone, body proportions, build, and natural appearance consistent. Do not change their identity or make them into a different person."
    : "No person reference was supplied. Create one realistic adult editorial fashion model with a natural, relaxed full-body pose. Do not use an illustrated avatar, mannequin, collage, or vector drawing.";
  const garmentInstruction = referenceCount > (hasBodyReference ? 1 : 0)
    ? "The remaining reference images are the exact wardrobe items. Use only those garments. Preserve each item’s actual silhouette, cut, color, material, seams, straps, sleeves, hardware, patterns, and visible branding. Do not substitute them with similar products, invent a logo, or add extra garments."
    : "Use the listed garments exactly as described. Do not add items not listed.";

  return [
    "Use case: identity-preserve virtual try-on, high-end editorial fashion photography.",
    "Asset type: Lookly outfit preview in a mobile wardrobe app.",
    personInstruction,
    garmentInstruction,
    "Render a premium, photorealistic, full-length fashion editorial photograph — never a 2D avatar, cartoon, flat vector, clothing chart, split-screen, text label, or mood board.",
    "Dress the model in a coherent outfit built from the selected items. Fit and drape every garment naturally around shoulders, chest, waist, hips, legs, and feet. Respect fabric physics and proportions.",
    "Clean up source imperfections before rendering: remove crop/background artifacts, blur, camera noise, glare, wrinkles, lint, warped edges, and messy folds. Garments should be pristine, freshly steamed and realistic, but must retain their true construction and material texture.",
    "Use bright, soft, diffused studio lighting with a clean minimalist warm off-white, pale beige, or soft gray backdrop. Center the person, show the full outfit from head to feet with comfortable margins, and keep the styling sharp and high resolution.",
    `Styling context: ${mood || "casual"} mood, ${weather || "clear"} weather, approximately ${temperature ?? 22}°C.`,
    "Selected wardrobe items (include only the applicable items; no text in the image):",
    garments,
    "Avoid: duplicated limbs, duplicate garments, cut-off feet, missing shoes, distorted hands, item-name banners, watermarks, captions, logos not present in references, heavy shadows, busy backgrounds.",
  ].join("\n");
}

router.post("/outfit-preview", async (req, res) => {
  const {
    items,
    weather = "Clear",
    temperature = 22,
    mood = "casual",
    userBodyPhotoBase64,
    userBodyPhotoMime = "image/jpeg",
    itemImages = [],
  } = req.body as {
    items: Item[];
    weather?: string;
    temperature?: number;
    mood?: string;
    userBodyPhotoBase64?: string;
    userBodyPhotoMime?: string;
    itemImages?: ReferenceImage[];
  };

  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "At least one item is required" });
    return;
  }

  const bodyReference = cleanBase64(userBodyPhotoBase64);
  const garmentReferences = Array.isArray(itemImages)
    ? itemImages.slice(0, 5).flatMap((reference) => {
      const imageBase64 = cleanBase64(reference.imageBase64);
      return imageBase64 ? [{ imageBase64, imageMime: reference.imageMime || "image/png" }] : [];
    })
    : [];
  const references = [
    ...(bodyReference ? [{ imageBase64: bodyReference, imageMime: userBodyPhotoMime }] : []),
    ...garmentReferences,
  ];
  const prompt = makePreviewPrompt(items, weather, temperature, mood, !!bodyReference, references.length);

  try {
    const image = references.length > 0
      ? await generateImageFromReferences(references, prompt, "1024x1536")
      : await generateImageBuffer(prompt, "1024x1536");
    res.json({
      image: image.toString("base64"),
      mimeType: "image/png",
      mode: "photorealistic",
    });
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("[outfit-preview] image generation failed:", detail.slice(0, 500));
    res.status(503).json({
      error: "Photo-real look preview is temporarily unavailable. Please try again shortly.",
      code: "IMAGE_GENERATION_UNAVAILABLE",
    });
  }
});

export default router;
