import { Router } from "express";
import { geminiChatWithImages } from "@workspace/integrations-gemini-ai-server";
import { createCanvas, loadImage } from "canvas";

const router = Router();

type ComparisonCandidate = {
  id: string;
  name: string;
  imageBase64: string;
  mimeType?: string;
  visualSignature?: unknown;
};

function cleanBase64(value: string): string {
  return value.includes(",") ? (value.split(",")[1] ?? "") : value;
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

async function comparisonThumbnail(imageBase64: string, mimeType: string): Promise<{ imageBase64: string; mimeType: string }> {
  const clean = cleanBase64(imageBase64);
  const image = await loadImage(`data:${mimeType};base64,${clean}`);
  const scale = Math.min(1, 640 / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = createCanvas(width, height);
  canvas.getContext("2d").drawImage(image, 0, 0, width, height);
  return {
    imageBase64: canvas.toBuffer("image/jpeg", { quality: 0.72 }).toString("base64"),
    mimeType: "image/jpeg",
  };
}

router.post("/compare-clothing", async (req, res) => {
  const body = req.body as {
    imageBase64?: string;
    mimeType?: string;
    itemName?: string;
    locationHint?: string;
    visualSignature?: unknown;
    candidates?: ComparisonCandidate[];
  };
  const imageBase64 = cleanBase64(body.imageBase64 ?? "");
  const candidates = Array.isArray(body.candidates)
    ? body.candidates.filter((candidate) => candidate?.id && candidate?.imageBase64).slice(0, 3)
    : [];

  if (!imageBase64 || candidates.length === 0) {
    res.status(400).json({ error: "A current image and at least one candidate image are required." });
    return;
  }

  const sourceImages = [
    { imageBase64, mimeType: body.mimeType?.startsWith("image/") ? body.mimeType : "image/jpeg" },
    ...candidates.map((candidate) => ({
      imageBase64: cleanBase64(candidate.imageBase64),
      mimeType: candidate.mimeType?.startsWith("image/") ? candidate.mimeType : "image/jpeg",
    })),
  ];
  const candidateList = candidates.map((candidate, index) => ({
    imageNumber: index + 2,
    id: candidate.id,
    name: candidate.name,
    visualSignature: candidate.visualSignature ?? null,
  }));

  try {
    const images = await Promise.all(sourceImages.map((image) => comparisonThumbnail(image.imageBase64, image.mimeType)));
    const raw = await geminiChatWithImages({
      images,
      maxOutputTokens: 1024,
      text: `Image 1 contains the newly scanned item named "${body.itemName ?? "item"}" at "${body.locationHint ?? "unspecified location"}".
The remaining images are possible matches from the same user's private wardrobe, in this order:
${JSON.stringify(candidateList)}
New item signature: ${JSON.stringify(body.visualSignature ?? null)}

Decide whether image 1 and any candidate show the SAME PHYSICAL ITEM photographed again. Similar category and color alone are not enough. Compare construction, shape/cut, pattern placement, closures, pockets, collar/sleeves, hardware, watch display type and face shape, and other stable details. Digital versus analog, round versus rectangular, different sleeve length, or a different pattern are hard contradictions. Be conservative when visibility is poor.

Return only JSON: {"candidateId": string|null, "confidence": number from 0 to 1, "sameItem": boolean, "contradictions": string[], "reason": string}. Set sameItem true only when confidence is at least 0.85.`,
    });
    const parsed = parseJsonObject(raw);
    const candidateId = typeof parsed?.candidateId === "string" && candidates.some((candidate) => candidate.id === parsed.candidateId)
      ? parsed.candidateId
      : null;
    const confidenceValue = typeof parsed?.confidence === "number" ? parsed.confidence : Number(parsed?.confidence ?? 0);
    const confidence = Number.isFinite(confidenceValue) ? Math.min(1, Math.max(0, confidenceValue)) : 0;
    const contradictions = Array.isArray(parsed?.contradictions)
      ? parsed.contradictions.map(String).filter(Boolean).slice(0, 6)
      : [];
    const sameItem = parsed?.sameItem === true && confidence >= 0.85 && candidateId !== null && contradictions.length === 0;
    res.json({
      candidateId,
      confidence,
      sameItem,
      contradictions,
      reason: typeof parsed?.reason === "string" ? parsed.reason.slice(0, 300) : "",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[compare-clothing] comparison failed:", message.slice(0, 300));
    res.status(502).json({ error: "Visual duplicate comparison is temporarily unavailable." });
  }
});

export default router;
