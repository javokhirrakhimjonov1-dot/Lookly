import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

interface BrandLogo {
  brand: string;
  description: string;
  position: string;
  size: "small" | "medium" | "large";
}

router.post("/remove-bg", async (req, res) => {
  const {
    photoBase64,
    mimeType,
    itemName,
    category,
    colorName,
    colorHex,
    material,
    brandLogo,
  } = req.body as {
    photoBase64?: string;
    mimeType?: string;
    itemName?: string;
    category?: string;
    colorName?: string;
    colorHex?: string;
    material?: string;
    brandLogo?: BrandLogo;
  };

  const itemLabel = itemName || category || "clothing item";
  const colorPart = [colorName, colorHex ? `(${colorHex})` : ""].filter(Boolean).join(" ");
  const materialPart = material ? `, ${material}` : "";

  const logoPart = brandLogo
    ? ` The item has a ${brandLogo.size} ${brandLogo.description} (${brandLogo.brand} logo) at the ${brandLogo.position} — render it faithfully.`
    : " No logos, no brand marks, no text, no graphics on the item.";

  try {
    // ── Path A: actual photo provided → remove background from real image ──
    if (photoBase64) {
      const buffer = Buffer.from(photoBase64, "base64");
      const photoMime = mimeType ?? "image/jpeg";

      // Node 24 has native File / Blob
      const file = new File([buffer], "garment.jpg", { type: photoMime });

      const editPrompt =
        `Clean professional fashion product photo. ` +
        `Remove the background completely and replace it with pure white (#FFFFFF). ` +
        `Keep only the ${colorPart ? `${colorPart} ` : ""}${itemLabel}${materialPart} exactly as it appears — do not alter the garment shape, colour, or texture. ` +
        `Crisp edges, no drop shadows, no reflections, no mannequin, no model body parts.` +
        logoPart;

      const response = await openai.images.edit({
        model: "gpt-image-1",
        image: file,
        prompt: editPrompt,
        n: 1,
        size: "1024x1024",
      });

      const b64 = (response.data?.[0] as { b64_json?: string } | undefined)?.b64_json;
      if (!b64) {
        res.status(500).json({ error: "No image data returned from edit" });
        return;
      }

      res.json({ image: b64 });
      return;
    }

    // ── Path B: no photo — generate an AI product illustration from metadata ──
    const genPrompt =
      `Clean product photo of a ${colorPart ? `${colorPart} ` : ""}${itemLabel}${materialPart}. ` +
      `Pure white (#FFFFFF) background. Flat-lay or standing view. ` +
      `Professional fashion photography, soft even lighting, no shadows, no people, no mannequin. ` +
      `Item centred and fills 80% of the frame. Highly detailed, true-to-life colours and textures.` +
      logoPart;

    const response = await openai.images.generate({
      model: "gpt-image-1",
      prompt: genPrompt,
      size: "1024x1024",
      n: 1,
    });

    const b64 = (response.data?.[0] as { b64_json?: string } | undefined)?.b64_json;
    if (!b64) {
      res.status(500).json({ error: "No image data returned" });
      return;
    }

    res.json({ image: b64 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg || "Image processing failed" });
  }
});

export default router;
