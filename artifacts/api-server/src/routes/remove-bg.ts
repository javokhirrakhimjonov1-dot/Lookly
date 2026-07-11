import { Router } from "express";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { removeBackground } from "@imgly/background-removal-node";

const router = Router();

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.resolve(import.meta.dirname, "../../../uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

router.post("/remove-bg", async (req, res) => {
  const { photoBase64, mimeType = "image/jpeg" } = req.body as {
    photoBase64?: string;
    mimeType?: string;
  };

  if (!photoBase64) {
    res.status(400).json({ error: "photoBase64 is required" });
    return;
  }

  try {
    const raw = photoBase64.includes(",") ? photoBase64.split(",")[1] : photoBase64;
    const inputBuffer = Buffer.from(raw, "base64");
    const inputBlob = new Blob([inputBuffer], { type: mimeType });
    const resultBlob = await removeBackground(inputBlob as any, {
      model: "medium",
      output: { format: "image/png", quality: 0.8 },
    });
    const resultBuffer = Buffer.from(await resultBlob.arrayBuffer());
    const filename = `${crypto.randomUUID()}.png`;
    const filePath = path.join(UPLOADS_DIR, filename);
    fs.writeFileSync(filePath, resultBuffer);
    const url = `/uploads/${filename}`;
    const resultBase64 = resultBuffer.toString("base64");
    res.json({ image: resultBase64, mimeType: "image/png", url });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg || "Background removal failed" });
  }
});

export default router;
