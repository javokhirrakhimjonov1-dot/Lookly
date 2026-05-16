import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

const SYSTEM_PROMPT = `You are a fashion expert and textile analyst. Carefully examine the photo and identify EVERY distinct clothing item or accessory visible — whether it is being worn, laid flat, hanging, or placed on a surface.

Return a JSON object with a single key "items" containing an array. Each element of the array is one clothing item with these exact fields:
- name: specific descriptive name (e.g. "White linen button-down shirt", "Navy blue slim-fit jeans", "Brown leather loafers")
- category: exactly one of "tops", "bottoms", "dresses", "outerwear", "shoes", "accessories"
- colorName: dominant color name, pick the closest from: Black, White, Beige, Navy, Camel, Burgundy, Olive, Gray, Blush, Denim, Terracotta, Cream. If none match, pick the nearest.
- colorHex: hex code matching colorName — Black:#1C1512, White:#FAF8F5, Beige:#E8D5B7, Navy:#1E3A5F, Camel:#C19A6B, Burgundy:#800020, Olive:#6B7C4D, Gray:#8A8A8A, Blush:#E8A0A0, Denim:#5B7FA6, Terracotta:#C8906A, Cream:#FAF0E6
- material: fabric composition (e.g. "100% cotton", "80% polyester 20% elastane", "genuine leather", "silk blend", "wool knit", "linen"). Guess from appearance if not obvious.
- fabricWeight: exactly one of "light", "medium", "heavy" based on the material (light=linen/cotton voile, medium=denim/knit/wool, heavy=leather/puffer/thick coat)
- seasons: array of suitable seasons from ["spring", "summer", "fall", "winter"] (can include multiple)
- tags: array of 2-4 style descriptors (e.g. ["casual", "workwear", "minimal", "streetwear", "formal", "boho", "sporty"])
- locationHint: a short phrase saying where in the image this item is (e.g. "worn on top", "bottom half", "left shoe", "hanging on rack", "folded on left"). This helps the user identify which item is which.

Rules:
- Include EVERY distinct item you can see — tops, bottoms, shoes, bags, hats, belts, jackets, dresses, etc.
- If only one item is visible, return an array with one object.
- Do NOT include the same item twice.
- Maximum 6 items.
- Return ONLY valid JSON — no markdown fences, no explanation, no extra text.

Example for a flat-lay photo with a shirt, jeans, and sneakers:
{"items":[{"name":"White oversized cotton tee","category":"tops","colorName":"White","colorHex":"#FAF8F5","material":"100% cotton jersey","fabricWeight":"light","seasons":["spring","summer"],"tags":["casual","minimal","streetwear"],"locationHint":"top of flat lay"},{"name":"Blue slim-fit jeans","category":"bottoms","colorName":"Denim","colorHex":"#5B7FA6","material":"98% cotton 2% elastane denim","fabricWeight":"medium","seasons":["spring","summer","fall"],"tags":["casual","minimal"],"locationHint":"middle of flat lay"},{"name":"White leather sneakers","category":"shoes","colorName":"White","colorHex":"#FAF8F5","material":"genuine leather upper","fabricWeight":"medium","seasons":["spring","summer","fall"],"tags":["casual","streetwear","sporty"],"locationHint":"bottom of flat lay"}]}`;

router.post("/identify-clothing", async (req, res) => {
  const { image, mimeType = "image/jpeg" } = req.body as {
    image: string;
    mimeType?: string;
  };

  if (!image) {
    res.status(400).json({ error: "image is required (base64)" });
    return;
  }

  const response = await openai.chat.completions.create({
    model: "gpt-5.1",
    max_completion_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${image}`,
              detail: "high",
            },
          },
          {
            type: "text",
            text: SYSTEM_PROMPT,
          },
        ],
      },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "";

  let parsed: {
    items: {
      name: string;
      category: string;
      colorName: string;
      colorHex: string;
      material: string;
      fabricWeight: string;
      seasons: string[];
      tags: string[];
      locationHint: string;
    }[];
  };

  try {
    parsed = JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
      res.status(422).json({ error: "Could not parse AI response", raw });
      return;
    }
    parsed = JSON.parse(match[0]);
  }

  const items = Array.isArray(parsed.items) ? parsed.items : [];

  res.json({
    items: items.map((item) => ({
      name: item.name ?? "",
      category: item.category ?? "tops",
      colorName: item.colorName ?? "Black",
      colorHex: item.colorHex ?? "#1C1512",
      material: item.material ?? "Unknown",
      fabricWeight: item.fabricWeight ?? "medium",
      seasons: Array.isArray(item.seasons) ? item.seasons : [],
      tags: Array.isArray(item.tags) ? item.tags : [],
      locationHint: item.locationHint ?? "",
    })),
  });
});

export default router;
