import { Router } from "express";
import { geminiChatWithImage } from "@workspace/integrations-gemini-ai-server";
import { isUnsupportedSpecialistItem, normalizeCategory } from "../data/recognitionTaxonomy";

const router = Router();

function isExcludedElectronicAccessory(name: unknown, tags: unknown, itemType: unknown): boolean {
  const searchable = `${typeof name === "string" ? name : ""} ${Array.isArray(tags) ? tags.join(" ") : ""} ${typeof itemType === "string" ? itemType : ""}`.toLowerCase();
  return /\b(?:phones?|smart\s*phones?|cell(?:ular)?\s+phones?|mobile\s+phones?|i\s*phones?|telephones?|ear\s*phones?|head\s*phones?|ear\s*buds?|air\s*pods?|headsets?)\b/.test(searchable);
}

const SYSTEM_PROMPT = `You are a fashion expert and textile analyst. Examine the photo and identify ONLY the clothing items that are clearly and fully visible.

Return a JSON object with a single key "items" containing an array. Each element is one clothing item with these exact fields:
- name: specific descriptive English name (e.g. "White linen button-down shirt", "Navy blue slim-fit jeans", "Brown leather loafers")
- localizedNames: the same concise, natural product name translated by you into all supported languages, exactly { "en": "...", "ru": "...", "uz": "..." }. Do not transliterate English words when a normal clothing term exists.
- category: exactly one of "tops", "bottoms", "dresses", "outerwear", "shoes", "socks", "accessories"
- Socks, ankle socks, crew socks, hosiery, tights, and stockings are always category "socks". Never classify them as accessories.
- Accessories are only watches, smart bands, belts, bags, jewellery, hats, scarves, or sunglasses.
- NEVER include phones, smartphones, mobile/cell phones, phone cases, earphones, earbuds, AirPods, headphones, or headsets. Ignore these completely even when they are fully visible, worn, or carried; do not return them as accessories or under any other category.
- colorName: dominant color name, pick the closest from: Black, White, Beige, Navy, Camel, Burgundy, Olive, Gray, Blush, Denim, Terracotta, Cream. If none match, pick the nearest.
- colorHex: hex code matching colorName — Black:#1C1512, White:#F9F8F6, Beige:#E8D5B7, Navy:#1E3A5F, Camel:#C19A6B, Burgundy:#800020, Olive:#6B7C4D, Gray:#8A8A8A, Blush:#E8A0A0, Denim:#5B7FA6, Terracotta:#C8906A, Cream:#FAF0E6
- material: fabric composition (e.g. "100% cotton", "80% polyester 20% elastane", "genuine leather", "silk blend", "wool knit", "linen"). Guess from appearance if not obvious.
- fabricWeight: exactly one of "light", "medium", "heavy" based on the material (light=linen/cotton voile, medium=denim/knit/wool, heavy=leather/puffer/thick coat)
- seasons: array of suitable seasons from ["spring", "summer", "fall", "winter"] (can include multiple)
- tags: array of 2-4 style descriptors (e.g. ["casual", "workwear", "minimal", "streetwear", "formal", "boho", "sporty"])
- locationHint: a short phrase saying where in the image this item is (e.g. "worn on top", "bottom half", "left shoe", "hanging on rack", "folded on left").
- visualSignature: a normalized object describing visible construction, with exactly these fields:
  { "itemType": "specific subtype", "garmentFamily": "blouse, skirt, jumpsuit, boots, handbag, jewellery, etc.", "shape": "visible cut or shape", "silhouette": "fitted, straight, a-line, wrap, relaxed, oversized, wide-leg, etc.", "length": "cropped, hip, mini, knee, midi, maxi, ankle, full-length, or not-applicable", "pattern": "solid, striped, checked, printed, etc.", "materialFamily": "linen, cotton, leather, metal, denim, knit, synthetic, etc.", "closures": ["button", "zip", "buckle", etc.], "sleeve": "long, short, sleeveless, or not-applicable", "collar": "spread, crew, hood, not-applicable, etc.", "neckline": "crew, v-neck, square, high-neck, sweetheart, not-applicable, etc.", "rise": "low, mid, high, or not-applicable", "coverage": "standard, modest, maximum, or not-applicable", "opacity": "opaque, semi-sheer, sheer, or not-applicable", "layerRole": "base, mid, outer, standalone, or accessory", "toeStyle": "open, closed, peep-toe, pointed, round, or not-applicable", "heelType": "flat, block, stiletto, wedge, platform, kitten, or not-applicable", "heelHeight": "flat, low, medium, high, or not-applicable", "bootShaft": "ankle, mid-calf, knee, over-knee, or not-applicable", "features": ["2-5 concise stable visual details"] }
- Everyday wardrobes include blouses, skirts, bodysuits, jumpsuits, tights, heels, boots, handbags, jewellery, hijabs/headscarves, and layered modest-wear pieces. Describe these precisely without assuming the wearer's gender.
- Map skirts to bottoms, jumpsuits/rompers to dresses, bodysuits/blouses to tops, tights/hosiery to socks, heels/boots to shoes, and handbags/jewellery/hijabs to accessories.
- Do not return specialist lingerie, underwear, maternity garments, or swimwear in this version.
- Use "not-applicable" rather than inventing garment details. Describe stable construction, not pose, lighting, background, wrinkles, or temporary styling.
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
{"items":[{"name":"Grey zip-up hoodie","category":"tops","colorName":"Gray","colorHex":"#8A8A8A","material":"80% cotton 20% polyester fleece","fabricWeight":"medium","seasons":["fall","winter","spring"],"tags":["casual","streetwear","sporty"],"locationHint":"center of image","visualSignature":{"itemType":"zip-up hoodie","shape":"regular fit","pattern":"solid","materialFamily":"cotton fleece","closures":["front zip"],"sleeve":"long","collar":"hood","features":["drawstring hood","split front pocket"]}}]}

Example — flat-lay with shirt, jeans, and sneakers all fully visible:
{"items":[{"name":"White oversized cotton tee","category":"tops","colorName":"White","colorHex":"#F9F8F6","material":"100% cotton jersey","fabricWeight":"light","seasons":["spring","summer"],"tags":["casual","minimal","streetwear"],"locationHint":"top of flat lay"},{"name":"Blue slim-fit jeans","category":"bottoms","colorName":"Denim","colorHex":"#5B7FA6","material":"98% cotton 2% elastane denim","fabricWeight":"medium","seasons":["spring","summer","fall"],"tags":["casual","minimal"],"locationHint":"middle of flat lay"},{"name":"White leather sneakers","category":"shoes","colorName":"White","colorHex":"#F9F8F6","material":"genuine leather upper","fabricWeight":"medium","seasons":["spring","summer","fall"],"tags":["casual","streetwear","sporty"],"locationHint":"bottom of flat lay"}]}`;

router.post("/identify-clothing", async (req, res) => {
  const { image, mimeType = "image/jpeg" } = req.body as {
    image: string;
    mimeType?: string;
  };

  if (!image) {
    res.status(400).json({ error: "image is required (base64)" });
    return;
  }

  const cleanImage = image.includes(",") ? image.split(",")[1] : image;

  let raw: string;
  try {
    raw = await geminiChatWithImage({
      imageBase64: cleanImage,
      mimeType,
      text: SYSTEM_PROMPT,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[identify-clothing] Gemini error:", msg.slice(0, 500));
    if (msg.includes("quota") || msg.includes("429") || msg.includes("exceeded") || msg.includes("limit")) {
      res.status(429).json({ error: "AI identification is temporarily unavailable due to high demand. Please add items manually." });
    } else if (msg.includes("not support image") || msg.includes("does not support image") || msg.includes("Unable to process input image")) {
      res.status(503).json({ error: "AI identification is temporarily unavailable. Please add items manually." });
    } else if (/could not reach|fetch failed|EACCES|ENETUNREACH|EHOSTUNREACH|ECONN/i.test(msg)) {
      res.status(503).json({ error: "AI identification could not connect. Please try again in a moment." });
    } else {
      res.status(502).json({ error: "Identification service unavailable. Please try again or add items manually." });
    }
    return;
  }

  interface RawBrandLogo {
    brand?: string;
    description?: string;
    position?: string;
    size?: string;
  }

  interface RawVisualSignature {
    itemType?: string;
    garmentFamily?: string;
    shape?: string;
    silhouette?: string;
    length?: string;
    pattern?: string;
    materialFamily?: string;
    closures?: string[];
    sleeve?: string;
    collar?: string;
    neckline?: string;
    rise?: string;
    coverage?: string;
    opacity?: string;
    layerRole?: string;
    toeStyle?: string;
    heelType?: string;
    heelHeight?: string;
    bootShaft?: string;
    features?: string[];
  }

  let parsed: {
    items: {
      name: string;
      localizedNames?: { en?: string; ru?: string; uz?: string };
      category: string;
      colorName: string;
      colorHex: string;
      material: string;
      fabricWeight: string;
      seasons: string[];
      tags: string[];
      locationHint: string;
      brandLogo?: RawBrandLogo | null;
      visualSignature?: RawVisualSignature | null;
    }[];
  };

  try {
    parsed = JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
      console.error("[identify-clothing] Non-JSON response:", raw.slice(0, 500));
      res.status(422).json({ error: "AI identification returned incomplete data. Please try the photo again." });
      return;
    }
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      console.error("[identify-clothing] Invalid JSON response:", raw.slice(0, 500));
      res.status(422).json({ error: "AI identification returned incomplete data. Please try the photo again." });
      return;
    }
  }

  const items = (Array.isArray(parsed.items) ? parsed.items : []).filter(
    (item) => !isExcludedElectronicAccessory(item.name, item.tags, item.visualSignature?.itemType)
      && !isUnsupportedSpecialistItem(item.name, item.tags, item.visualSignature?.itemType),
  );

  res.json({
    items: items.map((item) => {
      const logo = item.brandLogo;
      const signature = item.visualSignature;
      const validSizes = ["small", "medium", "large"];
      return {
        name: item.name ?? "",
        localizedNames: {
          en: String(item.localizedNames?.en ?? item.name ?? "").trim(),
          ru: String(item.localizedNames?.ru ?? "").trim(),
          uz: String(item.localizedNames?.uz ?? "").trim(),
        },
        category: normalizeCategory(item.category, item.name, item.tags),
        colorName: item.colorName ?? "Black",
        colorHex: item.colorHex ?? "#1C1512",
        material: item.material ?? "Unknown",
        fabricWeight: item.fabricWeight ?? "medium",
        seasons: Array.isArray(item.seasons) ? item.seasons : [],
        tags: Array.isArray(item.tags) ? item.tags : [],
        locationHint: item.locationHint ?? "",
        visualSignature: signature
          ? {
              itemType: String(signature.itemType ?? "").trim().toLowerCase(),
              garmentFamily: String(signature.garmentFamily ?? signature.itemType ?? "").trim().toLowerCase(),
              shape: String(signature.shape ?? "").trim().toLowerCase(),
              silhouette: String(signature.silhouette ?? signature.shape ?? "").trim().toLowerCase(),
              length: String(signature.length ?? "not-applicable").trim().toLowerCase(),
              pattern: String(signature.pattern ?? "").trim().toLowerCase(),
              materialFamily: String(signature.materialFamily ?? "").trim().toLowerCase(),
              closures: Array.isArray(signature.closures)
                ? signature.closures.map((value) => String(value).trim().toLowerCase()).filter(Boolean).slice(0, 5)
                : [],
              sleeve: String(signature.sleeve ?? "not-applicable").trim().toLowerCase(),
              collar: String(signature.collar ?? "not-applicable").trim().toLowerCase(),
              neckline: String(signature.neckline ?? signature.collar ?? "not-applicable").trim().toLowerCase(),
              rise: String(signature.rise ?? "not-applicable").trim().toLowerCase(),
              coverage: String(signature.coverage ?? "standard").trim().toLowerCase(),
              opacity: String(signature.opacity ?? "opaque").trim().toLowerCase(),
              layerRole: String(signature.layerRole ?? (item.category === "dresses" ? "standalone" : "base")).trim().toLowerCase(),
              toeStyle: String(signature.toeStyle ?? "not-applicable").trim().toLowerCase(),
              heelType: String(signature.heelType ?? "not-applicable").trim().toLowerCase(),
              heelHeight: String(signature.heelHeight ?? "not-applicable").trim().toLowerCase(),
              bootShaft: String(signature.bootShaft ?? "not-applicable").trim().toLowerCase(),
              features: Array.isArray(signature.features)
                ? signature.features.map((value) => String(value).trim().toLowerCase()).filter(Boolean).slice(0, 5)
                : [],
            }
          : undefined,
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
