import { Router } from "express";
import {
  generateImageBuffer,
  generateImageFromReferences,
  getGeminiImageModel,
} from "@workspace/integrations-gemini-ai-server";
import { getOutfitModestyIssues } from "../engine/modestyRules";
import type { Item as EngineItem, UserProfile } from "../engine/weatherEngine";

const router = Router();

type Item = {
  name: string;
  color: string;
  colorHex: string;
  category: string;
  visualSignature?: { garmentFamily?: string; silhouette?: string; length?: string; sleeve?: string; neckline?: string; coverage?: string; opacity?: string; toeStyle?: string; heelType?: string; heelHeight?: string; bootShaft?: string };
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

async function withGenerationTimeout<T>(operation: Promise<T>, timeoutMs = 70_000): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("Image generation timed out")),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

/** Gemini 3.1 is the preferred high-fidelity preview engine. Some billing
 * projects do not yet have it enabled, so retry exactly once with Gemini 2.5
 * Flash Image, Google's stable low-latency image model, when access to the
 * requested model itself is rejected. */
async function generatePreviewWithModelFallback(
  references: Array<{ imageBase64: string; imageMime: string; label?: string }>,
  prompt: string,
) {
  const create = (model: string) => references.length > 0
    ? generateImageFromReferences(references, prompt, "1024x1536", model)
    : generateImageBuffer(prompt, "1024x1536", model);

  try {
    return await withGenerationTimeout(create(getGeminiImageModel()));
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    const modelUnavailable = /404|not found|not supported|model.*(?:unavailable|access)/i.test(detail);
    if (!modelUnavailable || getGeminiImageModel() === "gemini-2.5-flash-image") throw error;
    console.warn("[outfit-preview] preferred image model unavailable; retrying stable fallback");
    return withGenerationTimeout(create("gemini-2.5-flash-image"));
  }
}

function makePreviewPrompt(
  items: Item[],
  weather: string,
  temperature: number,
  mood: string,
  hasBodyReference: boolean,
  referenceCount: number,
  userGender?: string,
  userAge?: number,
  stylingPreferences?: Record<string, string>,
): string {
  const garments = items.map((item, index) =>
    `${index + 1}. ${item.name} — ${item.category}, ${item.color} (${item.colorHex}); construction ${JSON.stringify(item.visualSignature ?? {})}`,
  ).join("\n");
  const personInstruction = hasBodyReference
    ? "REFERENCE 1 is the PERSON IDENTITY AND BODY reference. Treat this as an image-editing task, not as permission to invent a similar model. The output must show this exact same person: preserve their face and facial geometry, eyes, nose, mouth, jawline, skin tone, hair color and hairstyle, apparent age, body proportions, and build. Change only the clothing, pose, lighting, and background needed for the outfit preview. Do not beautify, age, de-age, gender-swap, replace, or synthesize a lookalike. If a garment reference contains another person, ignore that person completely."
    : "No person reference was supplied. Create one realistic editorial fashion model with a natural, relaxed full-body pose. Match the profile age when provided. Do not use an illustrated avatar, mannequin, collage, or vector drawing.";
  const garmentInstruction = referenceCount > (hasBodyReference ? 1 : 0)
    ? "The remaining reference images are the exact wardrobe items. Use only those garments. Preserve each item’s actual silhouette, cut, color, material, seams, straps, sleeves, hardware, patterns, and visible branding. Do not substitute them with similar products, invent a logo, or add extra garments."
    : "Use the listed garments exactly as described. Do not add items not listed.";
  const presentationInstruction = hasBodyReference
    ? "The visible person in REFERENCE 1 is the sole authority for identity and presentation. Profile metadata and garment references must never override their appearance."
    : userGender === "male"
      ? "The model must present as male."
      : userGender === "female"
        ? "The model must present as female."
        : "Use a model whose presentation is appropriate to the selected wardrobe and profile.";

  return [
    "Use case: identity-preserve virtual try-on, high-end editorial fashion photography.",
    "Asset type: Lookly outfit preview in a mobile wardrobe app.",
    personInstruction,
    presentationInstruction,
    "SAFETY AND MODESTY REQUIREMENT: The model must be fully and modestly clothed in every result. Never show a bare chest, exposed torso, underwear, genital area, buttocks, or see-through clothing. Do not remove, open, unbutton, unzip, shorten, or alter any selected garment. If a selected shirt, jacket, cardigan, or overshirt could expose skin when open, render it fully fastened or layered so the torso stays completely covered.",
    `User styling preferences: ${JSON.stringify(stylingPreferences ?? {})}. Respect these without changing or inventing garments.`,
    userAge && !hasBodyReference ? `The model should read as approximately ${userAge} years old.` : "",
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
    userGender,
    userAge,
    stylingPreferences,
  } = req.body as {
    items: Item[];
    weather?: string;
    temperature?: number;
    mood?: string;
    userBodyPhotoBase64?: string;
    userBodyPhotoMime?: string;
    itemImages?: ReferenceImage[];
    userGender?: string;
    userAge?: number;
    stylingPreferences?: Record<string, string>;
  };

  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "At least one item is required" });
    return;
  }
  if (userAge !== undefined && (!Number.isInteger(userAge) || userAge < 12 || userAge > 50)) {
    res.status(400).json({ error: "userAge must be a whole number from 12 to 50", code: "INVALID_AGE" });
    return;
  }
  const effectiveStylingPreferences = userGender === "female" ? stylingPreferences : undefined;
  const profile: UserProfile = { gender:userGender, stylePreferences:["casual"], stylingPreferences:effectiveStylingPreferences as UserProfile["stylingPreferences"] };
  const engineItems: EngineItem[] = items.map((item, index) => ({
    id:String(index), name:item.name, category:item.category as EngineItem["category"], color:item.color || "black",
    seasons:[], weight:"medium", tags:[], garmentFamily:item.visualSignature?.garmentFamily,
    silhouette:item.visualSignature?.silhouette, length:item.visualSignature?.length, sleeve:item.visualSignature?.sleeve,
    neckline:item.visualSignature?.neckline, coverage:item.visualSignature?.coverage, opacity:item.visualSignature?.opacity,
    toeStyle:item.visualSignature?.toeStyle, heelType:item.visualSignature?.heelType, heelHeight:item.visualSignature?.heelHeight,
    bootShaft:item.visualSignature?.bootShaft,
  }));
  const modestyIssues = getOutfitModestyIssues(engineItems, profile);
  if (modestyIssues.length) {
    res.status(409).json({
      error: modestyIssues.includes("HIJAB_REQUIRED")
        ? "Add or identify a hijab in your wardrobe to complete this look."
        : "This look does not match the profile's current coverage settings.",
      code: modestyIssues[0],
      reasonCodes: modestyIssues,
    });
    return;
  }

  const bodyReference = cleanBase64(userBodyPhotoBase64);
  const garmentReferences = Array.isArray(itemImages)
    ? itemImages.slice(0, 5).flatMap((reference, index) => {
      const imageBase64 = cleanBase64(reference.imageBase64);
      return imageBase64 ? [{
        imageBase64,
        imageMime: reference.imageMime || "image/png",
        label: reference.label || `GARMENT ${index + 1} — clothing reference only; ignore any person or body visible in this image`,
      }] : [];
    })
    : [];
  // Gemini image generation is most reliable with a small set of high-value
  // references. A body reference plus two exact garment references avoids
  // the malformed collage-like images caused by overloading the model.
  const references = [
    ...(bodyReference ? [{
      imageBase64: bodyReference,
      imageMime: userBodyPhotoMime,
      label: "PERSON IDENTITY AND BODY — preserve this exact person; this is not a garment reference",
    }] : []),
    ...garmentReferences,
  ].slice(0, 3);
  const prompt = makePreviewPrompt(
    items, weather, temperature, mood, !!bodyReference, references.length, userGender, userAge, effectiveStylingPreferences,
  );

  try {
    const image = await generatePreviewWithModelFallback(references, prompt);
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
