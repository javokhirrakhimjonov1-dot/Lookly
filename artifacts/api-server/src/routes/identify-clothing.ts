import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

const SYSTEM_PROMPT = `You are a fashion expert and textile analyst. Examine the photo and identify ONLY the clothing items that are clearly and fully visible.

Return a JSON object with a single key "items" containing an array. Each element is one clothing item with these exact fields:
- name: specific descriptive name (e.g. "White linen button-down shirt", "Navy blue slim-fit jeans", "Brown leather loafers")
- category: exactly one of "tops", "bottoms", "dresses", "outerwear", "shoes", "accessories"
- colorName: dominant color name, pick the closest from: Black, White, Beige, Navy, Camel, Burgundy, Olive, Gray, Blush, Denim, Terracotta, Cream. If none match, pick the nearest.
- colorHex: hex code matching colorName — Black:#1C1512, White:#FAF8F5, Beige:#E8D5B7, Navy:#1E3A5F, Camel:#C19A6B, Burgundy:#800020, Olive:#6B7C4D, Gray:#8A8A8A, Blush:#E8A0A0, Denim:#5B7FA6, Terracotta:#C8906A, Cream:#FAF0E6
- material: fabric composition (e.g. "100% cotton", "80% polyester 20% elastane", "genuine leather", "silk blend", "wool knit", "linen"). Guess from appearance if not obvious.
- fabricWeight: exactly one of "light", "medium", "heavy" based on the material (light=linen/cotton voile, medium=denim/knit/wool, heavy=leather/puffer/thick coat)
- seasons: array of suitable seasons from ["spring", "summer", "fall", "winter"] (can include multiple)
- tags: array of 2-4 style descriptors (e.g. ["casual", "workwear", "minimal", "streetwear", "formal", "boho", "sporty"])
- locationHint: a short phrase saying where in the image this item is (e.g. "worn on top", "bottom half", "left shoe", "hanging on rack", "folded on left").
- brandLogo: null if no brand mark, logo, wordmark, emblem, or graphic is clearly visible on the item. If one IS visible: { "brand": "brand/label name if legible, otherwise 'Unknown'", "description": "concise visual description of the mark e.g. 'white embroidered swoosh', 'raised rubber three-stripe detail', 'embossed interlocking CC monogram', 'red Levi tab on back pocket'", "position": "location on the item e.g. 'left chest', 'center front', 'right sleeve', 'back upper center', 'left hip'", "size": "small | medium | large — proportion relative to the garment surface: small = subtle detail <5%, medium = noticeable 5-20%, large = dominant >20%" }

STRICT VISIBILITY RULES — follow these absolutely:
- ONLY include an item if at least 70% of it is clearly visible in the frame. If it is cut off, partially hidden, or only implied, DO NOT include it.
- If the photo shows only the upper body (chest, shoulders, torso), include ONLY upper-body items (tops, outerwear, accessories on the upper body). NEVER add bottoms, shoes, or lower-body items that are not visible.
- If the photo shows only a single clothing item (e.g. a hoodie laid flat or held up), return ONLY that one item.
- Do NOT guess, infer, or assume items that are not clearly shown. What you cannot see, you must not include.
- Do NOT include the same item twice.
- Maximum 6 items.
- Return ONLY valid JSON — no markdown fences, no explanation, no extra text.

Example — photo showing only a hoodie being held up:
{"items":[{"name":"Grey zip-up hoodie","category":"tops","colorName":"Gray","colorHex":"#8A8A8A","material":"80% cotton 20% polyester fleece","fabricWeight":"medium","seasons":["fall","winter","spring"],"tags":["casual","streetwear","sporty"],"locationHint":"center of image"}]}

Example — flat-lay with shirt, jeans, and sneakers all fully visible:
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

  interface RawBrandLogo {
    brand?: string;
    description?: string;
    position?: string;
    size?: string;
  }

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
      brandLogo?: RawBrandLogo | null;
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
    items: items.map((item) => {
      const logo = item.brandLogo;
      const validSizes = ["small", "medium", "large"];
      return {
        name: item.name ?? "",
        category: item.category ?? "tops",
        colorName: item.colorName ?? "Black",
        colorHex: item.colorHex ?? "#1C1512",
        material: item.material ?? "Unknown",
        fabricWeight: item.fabricWeight ?? "medium",
        seasons: Array.isArray(item.seasons) ? item.seasons : [],
        tags: Array.isArray(item.tags) ? item.tags : [],
        locationHint: item.locationHint ?? "",
        brandLogo:
          logo && logo.brand && logo.description && logo.position && logo.size
            ? {
                brand: logo.brand,
                description: logo.description,
                position: logo.position,
                size: validSizes.includes(logo.size) ? logo.size : "small",
              }
            : null,
      };
    }),
  });
});

export default router;
