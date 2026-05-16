import { Router } from "express";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { randomUUID } from "node:crypto";
import Ffmpeg from "fluent-ffmpeg";
import { openai, generateImageBuffer } from "@workspace/integrations-openai-ai-server";

const router = Router();

interface Scene {
  index: number;
  title: string;
  description: string;
  caption: string;
}

type JobStatus = "pending" | "processing" | "done" | "error";

interface Job {
  jobId: string;
  status: JobStatus;
  progress: number;
  step: string | null;
  scenes: Scene[];
  error: string | null;
  videoPath: string | null;
  createdAt: number;
}

const jobs = new Map<string, Job>();

const JOBS_DIR = path.join(os.tmpdir(), "sat-visualizer-jobs");
if (!fs.existsSync(JOBS_DIR)) {
  fs.mkdirSync(JOBS_DIR, { recursive: true });
}

function updateJob(job: Job, updates: Partial<Job>) {
  Object.assign(job, updates);
}

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

function wrapText(ctx: { measureText: (t: string) => { width: number } }, text: string, maxWidth: number): string[] {
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

    // Each input is a looped still held for sceneDuration seconds
    imagePaths.forEach((imgPath) => {
      command.addInput(imgPath);
      command.inputOptions([`-loop 1`, `-t ${sceneDuration}`]);
    });

    const filterParts: string[] = [];

    // Step 1: scale/pad/format every input to a uniform stream [v0]..[vN-1]
    imagePaths.forEach((_, i) => {
      filterParts.push(
        `[${i}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
        `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${fps},format=yuv420p[v${i}]`
      );
    });

    if (n === 1) {
      // Single scene — no transitions needed
      filterParts.push(`[v0]copy[outv]`);
    } else {
      // Step 2: chain xfade filters: [v0][v1]→[xf0], [xf0][v2]→[xf1], …
      // offset for xfade i = (i+1) * sceneDuration - (i+1) * transitionDuration
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

async function processJob(job: Job, passage: string) {
  const jobDir = path.join(JOBS_DIR, job.jobId);
  fs.mkdirSync(jobDir, { recursive: true });

  try {
    updateJob(job, { status: "processing", step: "Analyzing passage...", progress: 5 });

    const scenes = await breakIntoScenes(passage);
    updateJob(job, { scenes, step: "Generating scene images...", progress: 15 });

    const captionedPaths: string[] = [];
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const progressBase = 15 + Math.round((i / scenes.length) * 60);
      updateJob(job, { step: `Generating image ${i + 1} of ${scenes.length}...`, progress: progressBase });

      const rawPath = path.join(jobDir, `raw_${i}.png`);
      const captionedPath = path.join(jobDir, `captioned_${i}.png`);

      await generateSceneImage(scene, jobDir);
      fs.renameSync(path.join(jobDir, `scene_${i}.png`), rawPath);
      await addCaptionToImage(rawPath, scene.caption, scene.title, captionedPath);
      captionedPaths.push(captionedPath);
    }

    updateJob(job, { step: "Assembling video...", progress: 80 });

    const videoPath = path.join(jobDir, "output.mp4");
    await assembleVideo(captionedPaths, videoPath);

    updateJob(job, {
      status: "done",
      progress: 100,
      step: "Done!",
      videoPath,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    updateJob(job, {
      status: "error",
      progress: 0,
      step: null,
      error: `Generation failed: ${message}`,
    });
  }
}

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
    res.status(400).json({ error: "Unsupported image type. Use JPEG, PNG, WebP, or GIF." });
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
  const job: Job = {
    jobId,
    status: "pending",
    progress: 0,
    step: "Starting...",
    scenes: [],
    error: null,
    videoPath: null,
    createdAt: Date.now(),
  };
  jobs.set(jobId, job);

  setImmediate(() => void processJob(job, trimmed));

  res.json({
    jobId,
    status: job.status,
    scenes: job.scenes,
  });
});

router.get("/sat-visualizer/status/:jobId", (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);

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

router.get("/sat-visualizer/video/:jobId", (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);

  if (!job || job.status !== "done" || !job.videoPath) {
    res.status(404).json({ error: "Video not found or not ready" });
    return;
  }

  if (!fs.existsSync(job.videoPath)) {
    res.status(404).json({ error: "Video file not found" });
    return;
  }

  const stat = fs.statSync(job.videoPath);
  res.setHeader("Content-Type", "video/mp4");
  res.setHeader("Content-Length", stat.size);
  res.setHeader("Content-Disposition", `inline; filename="visualization.mp4"`);
  fs.createReadStream(job.videoPath).pipe(res);
});

export default router;
