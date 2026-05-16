import { Router } from "express";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { randomUUID } from "node:crypto";
import Ffmpeg from "fluent-ffmpeg";
import { openai, generateImageBuffer } from "@workspace/integrations-openai-ai-server";
import { db, satVisualizerJobs, type SatVisualizerScene } from "@workspace/db";
import { eq, lt } from "drizzle-orm";
import {
  serverUploadFile,
  serverDownloadFile,
  serverDeleteFile,
  satVisualizerVideoPath,
} from "../lib/objectStorage";

const router = Router();

type Scene = SatVisualizerScene;
type JobStatus = "pending" | "processing" | "done" | "error";

const JOB_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

// ---------------------------------------------------------------------------
// DB helpers — all updates use table column types directly (no casts)
// ---------------------------------------------------------------------------

async function updateJob(
  jobId: string,
  updates: Partial<{
    status: JobStatus;
    progress: number;
    step: string | null;
    scenes: Scene[];
    error: string | null;
    videoObjectPath: string | null;
  }>
) {
  await db.update(satVisualizerJobs).set(updates).where(eq(satVisualizerJobs.jobId, jobId));
}

// ---------------------------------------------------------------------------
// Startup: recover any jobs that were left in-flight when the server last died
// ---------------------------------------------------------------------------

async function recoverStuckJobs() {
  // Select both pending and processing before overwriting them
  const stuck = await db
    .select({ jobId: satVisualizerJobs.jobId })
    .from(satVisualizerJobs)
    .where(eq(satVisualizerJobs.status, "pending"));

  const inProgress = await db
    .select({ jobId: satVisualizerJobs.jobId })
    .from(satVisualizerJobs)
    .where(eq(satVisualizerJobs.status, "processing"));

  const recoveryUpdate = {
    status: "error" as JobStatus,
    step: null,
    error: "Server restarted during generation. Please try again.",
  };

  await db
    .update(satVisualizerJobs)
    .set(recoveryUpdate)
    .where(eq(satVisualizerJobs.status, "pending"));

  await db
    .update(satVisualizerJobs)
    .set(recoveryUpdate)
    .where(eq(satVisualizerJobs.status, "processing"));

  const total = stuck.length + inProgress.length;
  if (total > 0) {
    // Logger isn't available here (no req context), so use console.warn which
    // pino captures. Non-fatal — server boot continues regardless.
    console.warn(
      `[sat-visualizer] Marked ${total} stuck job(s) as error on startup ` +
        `(${stuck.length} pending, ${inProgress.length} processing)`
    );
  }
}

// ---------------------------------------------------------------------------
// Cleanup: delete expired jobs from DB AND their videos from object storage
// ---------------------------------------------------------------------------

async function purgeExpiredJobs() {
  const now = new Date();
  const expired = await db
    .select({ jobId: satVisualizerJobs.jobId, videoObjectPath: satVisualizerJobs.videoObjectPath })
    .from(satVisualizerJobs)
    .where(lt(satVisualizerJobs.expiresAt, now));

  for (const job of expired) {
    if (job.videoObjectPath) {
      await serverDeleteFile(job.videoObjectPath).catch((err: unknown) => {
        console.warn(
          `[sat-visualizer] Failed to delete GCS file for job ${job.jobId}:`,
          err
        );
      });
    }
    await db.delete(satVisualizerJobs).where(eq(satVisualizerJobs.jobId, job.jobId));
  }
}

// Run recovery and an initial cleanup at module load, then schedule ongoing cleanup
recoverStuckJobs().catch((err: unknown) => {
  console.warn("[sat-visualizer] Startup recovery failed:", err);
});

purgeExpiredJobs().catch((err: unknown) => {
  console.warn("[sat-visualizer] Startup cleanup failed:", err);
});

setInterval(() => {
  purgeExpiredJobs().catch((err: unknown) => {
    console.warn("[sat-visualizer] Periodic cleanup failed:", err);
  });
}, CLEANUP_INTERVAL_MS);

// ---------------------------------------------------------------------------
// AI helpers
// ---------------------------------------------------------------------------

async function breakIntoScenes(passage: string): Promise<Scene[]> {
  const response = await openai.chat.completions.create({
    model: "gpt-4.1",
    max_completion_tokens: 1200,
    messages: [
      {
        role: "system",
        content: `You are an expert at analyzing SAT reading passages and breaking them into 4-6 vivid visual scenes for animation. Each scene should capture a key moment, idea, or image from the text.`,
      },
      {
        role: "user",
        content: `Analyze this SAT reading passage and identify 4 to 6 key visual scenes. For each scene, provide:
1. A short title (3-6 words)
2. A vivid visual description suitable for generating a detailed illustration (focus on what would look good as an image: setting, characters, action, atmosphere, colors, lighting). 2-3 sentences.
3. A short caption (5-15 words) to display on screen as text

Passage:
"""
${passage}
"""

Return ONLY valid JSON in this exact format:
{
  "scenes": [
    {
      "index": 0,
      "title": "Scene title here",
      "description": "Vivid visual description for image generation...",
      "caption": "Short caption text for the screen"
    }
  ]
}

Rules:
- Return exactly 4 to 6 scenes
- Make each scene visually distinct
- Keep captions concise and educational
- Descriptions should be painterly and vivid for DALL-E image generation
- No markdown, no explanation — pure JSON only`,
      },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "";

  let parsed: { scenes: Scene[] };
  try {
    parsed = JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Failed to parse scenes from AI response");
    parsed = JSON.parse(match[0]);
  }

  return (parsed.scenes ?? []).map((s, i) => ({
    index: i,
    title: s.title ?? `Scene ${i + 1}`,
    description: s.description ?? "",
    caption: s.caption ?? "",
  }));
}

async function generateSceneImage(scene: Scene, jobDir: string): Promise<string> {
  const prompt = `Highly detailed, painterly illustration for an educational visualization. ${scene.description} Style: vivid, detailed, cinematic, editorial illustration, warm lighting, clear composition. No text or letters in the image.`;

  const buffer = await generateImageBuffer(prompt, "1024x1024");
  const imagePath = path.join(jobDir, `scene_${scene.index}.png`);
  fs.writeFileSync(imagePath, buffer);
  return imagePath;
}

// ---------------------------------------------------------------------------
// Image processing helpers
// ---------------------------------------------------------------------------

function wrapText(
  ctx: { measureText: (t: string) => { width: number } },
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

async function addCaptionToImage(
  imagePath: string,
  caption: string,
  sceneTitle: string,
  outputPath: string
): Promise<void> {
  const { createCanvas: makeCanvas, loadImage } = await import("canvas");

  const img = await loadImage(imagePath);
  const canvas = makeCanvas(img.width, img.height);
  const ctx = canvas.getContext("2d");

  ctx.drawImage(img, 0, 0);

  const paddingH = 32;
  const captionHeight = 120;
  const yStart = img.height - captionHeight;

  const gradient = ctx.createLinearGradient(0, yStart - 40, 0, img.height);
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(0.4, "rgba(0,0,0,0.55)");
  gradient.addColorStop(1, "rgba(0,0,0,0.85)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, yStart - 40, img.width, captionHeight + 40);

  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = "bold 20px sans-serif";
  ctx.fillText(sceneTitle.toUpperCase(), paddingH, yStart + 8);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 32px sans-serif";
  const lines = wrapText(ctx, caption, img.width - paddingH * 2);
  lines.forEach((line, i) => {
    ctx.fillText(line, paddingH, yStart + 44 + i * 40);
  });

  const out = fs.createWriteStream(outputPath);
  const stream = canvas.createPNGStream();
  await new Promise<void>((resolve, reject) => {
    stream.pipe(out);
    out.on("finish", resolve);
    out.on("error", reject);
  });
}

async function assembleVideo(imagePaths: string[], outputPath: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const command = Ffmpeg();

    const sceneDuration = 4;
    const transitionDuration = 0.5;
    const fps = 25;
    const width = 1024;
    const height = 1024;
    const n = imagePaths.length;

    imagePaths.forEach((imgPath) => {
      command.addInput(imgPath);
      command.inputOptions([`-loop 1`, `-t ${sceneDuration}`]);
    });

    const filterParts: string[] = [];

    imagePaths.forEach((_, i) => {
      filterParts.push(
        `[${i}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
          `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${fps},format=yuv420p[v${i}]`
      );
    });

    if (n === 1) {
      filterParts.push(`[v0]copy[outv]`);
    } else {
      for (let i = 0; i < n - 1; i++) {
        const leftLabel = i === 0 ? `[v0]` : `[xf${i - 1}]`;
        const rightLabel = `[v${i + 1}]`;
        const outLabel = i === n - 2 ? `[outv]` : `[xf${i}]`;
        const offset = (i + 1) * sceneDuration - (i + 1) * transitionDuration;
        filterParts.push(
          `${leftLabel}${rightLabel}xfade=transition=fade:duration=${transitionDuration}:offset=${offset}${outLabel}`
        );
      }
    }

    command
      .complexFilter(filterParts.join(";"))
      .outputOptions([
        "-map [outv]",
        `-r ${fps}`,
        "-c:v libx264",
        "-preset fast",
        "-crf 23",
        "-movflags +faststart",
      ])
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", (err: Error) => reject(err))
      .run();
  });
}

// ---------------------------------------------------------------------------
// Job processing
// ---------------------------------------------------------------------------

async function processJob(jobId: string, passage: string) {
  const jobDir = path.join(os.tmpdir(), "sat-visualizer-jobs", jobId);
  fs.mkdirSync(jobDir, { recursive: true });

  try {
    await updateJob(jobId, { status: "processing", step: "Analyzing passage...", progress: 5 });

    const scenes = await breakIntoScenes(passage);
    await updateJob(jobId, { scenes, step: "Generating scene images...", progress: 15 });

    const captionedPaths: string[] = [];
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const progressBase = 15 + Math.round((i / scenes.length) * 60);
      await updateJob(jobId, {
        step: `Generating image ${i + 1} of ${scenes.length}...`,
        progress: progressBase,
      });

      const rawPath = path.join(jobDir, `raw_${i}.png`);
      const captionedPath = path.join(jobDir, `captioned_${i}.png`);

      await generateSceneImage(scene, jobDir);
      fs.renameSync(path.join(jobDir, `scene_${scene.index}.png`), rawPath);
      await addCaptionToImage(rawPath, scene.caption, scene.title, captionedPath);
      captionedPaths.push(captionedPath);
    }

    await updateJob(jobId, { step: "Assembling video...", progress: 80 });

    const localVideoPath = path.join(jobDir, "output.mp4");
    await assembleVideo(captionedPaths, localVideoPath);

    await updateJob(jobId, { step: "Uploading video...", progress: 90 });

    const storagePath = satVisualizerVideoPath(jobId);
    const videoObjectPath = await serverUploadFile(localVideoPath, storagePath, "video/mp4");

    // Clean up local tmp files — non-fatal if it fails
    fs.rmSync(jobDir, { recursive: true, force: true });

    await updateJob(jobId, {
      status: "done",
      progress: 100,
      step: "Done!",
      videoObjectPath,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await updateJob(jobId, {
      status: "error",
      progress: 0,
      step: null,
      error: `Generation failed: ${message}`,
    });
  }
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

router.post("/sat-visualizer/extract-text", async (req, res) => {
  const { imageBase64, mimeType } = req.body as {
    imageBase64?: string;
    mimeType?: string;
  };

  if (!imageBase64 || !mimeType) {
    res.status(400).json({ error: "imageBase64 and mimeType are required" });
    return;
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!allowedTypes.includes(mimeType)) {
    res
      .status(400)
      .json({ error: "Unsupported image type. Use JPEG, PNG, WebP, or GIF." });
    return;
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4.1",
      max_completion_tokens: 2000,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${imageBase64}`,
                detail: "high",
              },
            },
            {
              type: "text",
              text: `Extract all the reading passage text from this image. Return only the passage text exactly as it appears, preserving paragraph breaks. Do not include any instructions, questions, line numbers, or your own commentary — only the passage text itself.`,
            },
          ],
        },
      ],
    });

    const text = response.choices[0]?.message?.content?.trim() ?? "";

    if (!text) {
      res.status(500).json({ error: "Could not extract text from the image." });
      return;
    }

    res.json({ text });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: `Text extraction failed: ${message}` });
  }
});

router.post("/sat-visualizer/visualize", async (req, res) => {
  const { passage } = req.body as { passage?: string };

  if (!passage || typeof passage !== "string") {
    res.status(400).json({ error: "passage is required" });
    return;
  }

  const trimmed = passage.trim();

  if (trimmed.length < 50) {
    res.status(400).json({ error: "Passage must be at least 50 characters." });
    return;
  }

  if (trimmed.length > 3000) {
    res.status(400).json({ error: "Passage must be at most 3000 characters." });
    return;
  }

  const jobId = randomUUID();
  const expiresAt = new Date(Date.now() + JOB_TTL_MS);

  await db.insert(satVisualizerJobs).values({
    jobId,
    status: "pending",
    progress: 0,
    step: "Starting...",
    scenes: [],
    error: null,
    videoObjectPath: null,
    expiresAt,
  });

  setImmediate(() => void processJob(jobId, trimmed));

  res.json({ jobId, status: "pending", scenes: [] });
});

router.get("/sat-visualizer/status/:jobId", async (req, res) => {
  const { jobId } = req.params;

  const [job] = await db
    .select()
    .from(satVisualizerJobs)
    .where(eq(satVisualizerJobs.jobId, jobId));

  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  res.json({
    jobId: job.jobId,
    status: job.status,
    progress: job.progress,
    step: job.step,
    scenes: job.scenes,
    error: job.error,
  });
});

router.get("/sat-visualizer/video/:jobId", async (req, res) => {
  const { jobId } = req.params;

  const [job] = await db
    .select()
    .from(satVisualizerJobs)
    .where(eq(satVisualizerJobs.jobId, jobId));

  if (!job || job.status !== "done" || !job.videoObjectPath) {
    res.status(404).json({ error: "Video not found or not ready" });
    return;
  }

  try {
    const videoBuffer = await serverDownloadFile(job.videoObjectPath);
    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Length", videoBuffer.length);
    res.setHeader("Content-Disposition", `inline; filename="visualization.mp4"`);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(videoBuffer);
  } catch {
    res.status(404).json({ error: "Video file not found in storage" });
  }
});

export default router;
