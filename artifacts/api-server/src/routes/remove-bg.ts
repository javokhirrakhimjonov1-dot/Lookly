import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

router.post("/remove-bg", async (req, res) => {
  const { itemName, category, colorName, colorHex, material } = req.body as {
    itemName?: string;
    category?: string;
    colorName?: string;
    colorHex?: string;
    material?: string;
  };

  const itemLabel = itemName || category || "clothing item";
  const colorPart = [colorName, colorHex ? `(${colorHex})` : ""].filter(Boolean).join(" ");
  const materialPart = material ? `, ${material}` : "";

  const prompt =
    `Clean product photo of a ${colorPart ? `${colorPart} ` : ""}${itemLabel}${materialPart}. ` +
    `Pure white (#FFFFFF) background. Flat-lay or standing view. ` +
    `Professional fashion photography, soft even lighting, no shadows, no people, no mannequin. ` +
    `Item centred and fills 80% of the frame. Highly detailed, true-to-life colours and textures.`;

  try {
    const response = await openai.images.generate({
      model: "gpt-image-1",
      prompt,
      size: "1024x1024",
      n: 1,
    });

    const b64 = (response.data[0] as { b64_json?: string } | undefined)?.b64_json;
    if (!b64) {
      res.status(500).json({ error: "No image data returned" });
      return;
    }

    res.json({ image: b64 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg || "Image generation failed" });
  }
});

export default router;
