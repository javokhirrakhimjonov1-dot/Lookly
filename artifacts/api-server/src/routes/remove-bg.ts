import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

router.post("/remove-bg", async (req, res) => {
  const { imageBase64, mimeType, itemName, category } = req.body as {
    imageBase64: string;
    mimeType?: string;
    itemName?: string;
    category?: string;
  };

  if (!imageBase64) {
    res.status(400).json({ error: "imageBase64 is required" });
    return;
  }

  const mime = mimeType ?? "image/jpeg";
  const buffer = Buffer.from(imageBase64, "base64");
  const file = new File([buffer], "clothing.jpg", { type: mime });

  const target = itemName ?? (category ? `${category} item` : "clothing item");
  const prompt =
    `Extract and isolate ONLY the ${target} from this photo. ` +
    `Crop tightly so the ${target} fills the frame from edge to edge — eliminate all empty margins. ` +
    `Remove the background, other people, other clothing items, furniture, and all surroundings completely. ` +
    `Place the ${target} centred on a pure white (#FFFFFF) background. ` +
    `Preserve every detail of the ${target} — texture, colour, stitching, buttons, patterns, shape. ` +
    `Do NOT modify the ${target} itself in any way.`;

  try {
    const response = await openai.images.edit({
      model: "gpt-image-1",
      image: file,
      prompt,
      size: "1024x1024",
    });

    const b64 = (response.data[0] as { b64_json?: string } | undefined)?.b64_json;
    if (!b64) {
      res.status(500).json({ error: "No image data returned" });
      return;
    }

    res.json({ image: b64 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const isQuota =
      msg.toLowerCase().includes("quota") ||
      msg.toLowerCase().includes("exceeded") ||
      msg.toLowerCase().includes("rate limit");
    res
      .status(isQuota ? 429 : 500)
      .json({ error: isQuota ? "Quota exceeded" : "Background removal failed" });
  }
});

export default router;
