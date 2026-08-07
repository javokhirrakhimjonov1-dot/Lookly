export const SCARF_CATALOG_PROCESSING_VERSION = 2;
export const FOOTWEAR_CATALOG_PROCESSING_VERSION = 3;
export const HEADBAND_CATALOG_PROCESSING_VERSION = 4;
export const WATCH_CATALOG_PROCESSING_VERSION = 5;
export const EYEWEAR_CATALOG_PROCESSING_VERSION = 6;
export const HOODIE_CATALOG_PROCESSING_VERSION = 7;

export type CatalogImagePolicy = {
  compositionRule: string;
  processingVersion?: number;
  preserveStudioBackground?: boolean;
  reviewRule?: string;
};

const HEADBAND_PATTERN = /(?:\bhead[ -]?band\b|\bhair[ -]?band\b|\bsweat[ -]?band\b|\bsports?[ -]?band\b|\bathletic[ -]?band\b)/i;
const SCARF_PATTERN = /(?:\bscarf\b|\bhead[ -]?scarf\b|\bhijab\b|\bkhimar\b|\bmuffler\b|\bpashmina\b|\bstole\b|\bneck wrap\b|\u0448\u0430\u0440\u0444|\u043f\u0430\u043b\u0430\u043d\u0442\u0438\u043d|\u043f\u043b\u0430\u0442\u043e\u043a|\bsharf\b|\bro['\u2019]?mol\b)/i;
const WATCH_PATTERN = /(?:\bsmart[ -]?watch\b|\bwrist[ -]?watch\b|\bwatch\b|\bfitness (?:band|tracker)\b|\bactivity tracker\b|\bsmart band\b)/i;
const EYEWEAR_PATTERN = /(?:\bsun[ -]?glasses\b|\beye[ -]?glasses\b|\bglasses\b|\bspectacles?\b|\beyewear\b|\bshades\b)/i;
const HOODIE_PATTERN = /(?:\bhoodies?\b|\bhooded (?:sweatshirt|jacket|top)\b|\bzip[ -]?up hood(?:ie|ed sweatshirt)\b)/i;

export function getCatalogImagePolicy(input: {
  category?: string;
  itemName?: string;
  material?: string;
  tags?: string[];
}): CatalogImagePolicy {
  const category = input.category?.toLocaleLowerCase();
  const description = [input.itemName, input.material, ...(Array.isArray(input.tags) ? input.tags : [])]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase();

  if (category === "shoes") {
    return {
      processingVersion: FOOTWEAR_CATALOG_PROCESSING_VERSION,
      compositionRule: "CRITICAL FOOTWEAR COMPOSITION FOR EVERY TYPE OF SHOE: the user's input photo is allowed to contain only one shoe; never reject it or require the user to photograph both shoes. The generated catalog image must always show exactly one complete matching pair (two shoes), never a single shoe. This rule applies without exception to sneakers, trainers, athletic shoes, boots, heels, sandals, loafers, flats, and every other kind of footwear. If the reference shows only one shoe, create its correctly mirrored matching mate with the same design, color, material, and details so the output is still a pair; this required mate is not an unintended duplicate or redesign. Use a true direct overhead/top-down catalog view, looking straight down at the uppers: both shoes parallel, side by side, evenly spaced, toes pointing toward the top of the canvas and heels toward the bottom. Keep both shoes fully visible, equal in size, symmetrically aligned, and uncropped. Do not use a front-facing, side, three-quarter, perspective, or worn view.",
    };
  }

  if (HEADBAND_PATTERN.test(description)) {
    return {
      processingVersion: HEADBAND_CATALOG_PROCESSING_VERSION,
      compositionRule: "CRITICAL HEADBAND COMPOSITION: show the complete elastic fabric loop in a straight-on retail front view at eye level, stretched naturally into a wide, low, perfectly horizontal oval. The broad front panel must face the camera squarely and run left to right; let only a narrow, symmetrical opening and the inside back edge remain visible above it so the loop construction is clear. Center it like a premium webshop product thumbnail. Preserve the reference headband's exact width, taper, seams, material, texture, color, and any genuine logo. Do not rotate it diagonally, stand it upright, twist it, fold it, flatten it into a single strip, or use an overhead, side, three-quarter, dramatic perspective, floating ring, or worn view. There must be no head, hair, forehead, face, skin, mannequin, or display form.",
    };
  }

  if (SCARF_PATTERN.test(description)) {
    return {
      processingVersion: SCARF_CATALOG_PROCESSING_VERSION,
      compositionRule: "CRITICAL SCARF COMPOSITION: present the scarf as a clearly recognizable textile product in an elegant upright retail drape, matching the reference style: one loose, broad loop or soft crossover near the upper third with two substantial ends hanging naturally downward. Keep the complete scarf visible with generous margins. Preserve its true length, width, rectangular, square, or triangular proportions, fabric weight, weave, edge finish, fringe, and tassels exactly; if it is a long rectangular scarf, emphasize its long broad panels and show both ends. Do not twist it into a tight knot, necktie, bow, rope, narrow ribbon, compact bundle, or generic piece of fabric. Do not show a neck, mannequin, head, body, hanger, pin, or styling prop.",
    };
  }

  if (category === "accessories" && EYEWEAR_PATTERN.test(description)) {
    return {
      processingVersion: EYEWEAR_CATALOG_PROCESSING_VERSION,
      // Thin white, clear, translucent, or metal frames are easily mistaken
      // for background by a generic segmentation model. The generated studio
      // square is already clean, so retain it instead of deleting frame pixels.
      preserveStudioBackground: true,
      compositionRule: "CRITICAL EYEWEAR COMPOSITION: show exactly one complete pair of glasses, detached and unworn, in a straight-on, centered retail view. Preserve the exact lens shape and tint and the complete real frame construction. Both lenses, the bridge connecting them, both rims or genuine rimless mounts, both outer corners and hinges, and both temples/arms must remain present, connected, symmetrical, and fully visible. For white, clear, translucent, pale, or thin metal frames, use enough edge definition and contrast against the warm off-white background that every frame component remains visibly intact without recoloring it. Never output loose lenses, lenses without their bridge or frame, a cropped frame, disconnected pieces, or glasses on a face, head, mannequin, or display stand.",
      reviewRule: "Reject the image if the eyewear is reduced to two loose lenses or if any real bridge, rim/frame section, outer corner, hinge, or temple/arm is missing, disconnected, invisible, or cropped. Pale and transparent frame parts still count and must be visibly intact.",
    };
  }

  if (category === "accessories" && WATCH_PATTERN.test(description)) {
    return {
      processingVersion: WATCH_CATALOG_PROCESSING_VERSION,
      compositionRule: "ABSOLUTE WATCH COMPOSITION RULE: show only the complete watch as a detached, unworn retail product. Present the watch face square to the camera and show the entire strap or bracelet clearly, arranged straight or in a clean self-supported loop as appropriate. Preserve the exact case, screen or dial, crown, buttons, strap, clasp, color, material, and proportions from the reference. The watch must not touch, wrap around, rest on, or be attached to anything. There must be empty background around and through the strap opening. NEVER show any wrist, arm, hand, fingers, skin, hair, sleeve, person, mannequin limb, plastic display wrist, jewelry stand, or other support—even partially. Do not imply a wearer. The only foreground object may be the watch itself.",
    };
  }

  if (HOODIE_PATTERN.test(description)) {
    return {
      processingVersion: HOODIE_CATALOG_PROCESSING_VERSION,
      compositionRule: "CRITICAL HOODIE COMPOSITION: show only the complete hoodie as a detached, unworn garment, centered, upright, and front-facing. Preserve the hood, neckline, zipper or pullover opening, drawstrings, sleeves, cuffs, pockets, hem, and true construction. The hoodie must be hollow and unsupported: empty background must be visible around it and wherever a wearer or display form would otherwise protrude. There must be no neck form inside the hood or collar, no shoulders or torso filling the garment, and no waist, hips, or mannequin extending below the hem. Never include a mannequin, dress form, hanger, person, skin, body part, or support, even if most of it is covered by the hoodie.",
      reviewRule: "Inspect the hood/collar opening and the area below the hem especially closely. Any beige, white, black, plastic, fabric-covered, or skin-like neck, shoulders, torso, waist, hips, or display form inside or behind the hoodie is a mannequin/support and must be rejected, even when the garment hides most of it.",
    };
  }

  if (category === "accessories") {
    return {
      compositionRule: "CRITICAL ACCESSORY COMPOSITION: show exactly one complete, detached, unworn accessory as a standalone retail product, centered and fully visible. Arrange it flat or naturally self-supported as appropriate to its construction. Preserve every real detail from the reference. Do not show or imply a wearer, and do not include skin, a head, neck, ear, hand, wrist, arm, torso, hair, mannequin, display body part, hanger, stand, or styling prop.",
    };
  }

  return {
    compositionRule: "GARMENT COMPOSITION: show one isolated garment only, centered, upright, and front-facing or laid flat as appropriate for that garment. It must be completely detached and unworn, with no person, skin, body part, mannequin, hanger, or styling prop.",
  };
}

export const CATALOG_ISOLATION_REVIEW_PROMPT = `Inspect this generated e-commerce catalog image. Return only JSON with exactly these fields: {"isolatedProductOnly":boolean,"hasHumanBodyPart":boolean,"hasMannequinOrSupport":boolean,"productComplete":boolean}. "isolatedProductOnly" is true only when the foreground contains the intended fashion product by itself. Set "hasHumanBodyPart" true for any visible person, face, hair, skin, hand, fingers, wrist, arm, leg, foot, neck, ear, or torso, even if cropped or partly hidden. Set "hasMannequinOrSupport" true for any mannequin body or body part, dress form, plastic limb, display wrist, jewelry stand, hanger, or other prop inside, behind, touching, filling, or supporting the product. Look inside garment openings and below garment hems; a mostly covered mannequin still counts. Set "productComplete" true only when the entire intended product and all of its real structural components are present, connected as appropriate, fully visible, and uncropped. A watch must be completely detached and unworn, with no wrist or arm inside its strap. Background and ordinary product shadows are allowed. Be strict.`;

export function getCatalogIsolationReviewPrompt(input: {
  itemName?: string;
  category?: string;
  reviewRule?: string;
}): string {
  return [
    CATALOG_ISOLATION_REVIEW_PROMPT,
    `The intended product is: ${input.itemName ?? input.category ?? "fashion product"}.`,
    input.reviewRule ?? "Reject missing, disconnected, or cropped structural product parts.",
  ].join(" ");
}

export function isolationReviewPassed(raw: string): boolean {
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return false;
    const parsed = JSON.parse(match[0]) as Record<string, unknown>;
    return parsed.isolatedProductOnly === true
      && parsed.hasHumanBodyPart === false
      && parsed.hasMannequinOrSupport === false
      && parsed.productComplete === true;
  } catch {
    return false;
  }
}
