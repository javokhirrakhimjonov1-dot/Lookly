import { pgTable, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export interface SatVisualizerScene {
  index: number;
  title: string;
  description: string;
  caption: string;
}

export const satVisualizerJobs = pgTable("sat_visualizer_jobs", {
  jobId: text("job_id").primaryKey(),
  status: text("status").notNull().$type<"pending" | "processing" | "done" | "error">(),
  progress: integer("progress").notNull().default(0),
  step: text("step"),
  scenes: jsonb("scenes").notNull().default([]).$type<SatVisualizerScene[]>(),
  thumbnails: jsonb("thumbnails").notNull().default([]).$type<string[]>(),
  error: text("error"),
  videoObjectPath: text("video_object_path"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const insertSatVisualizerJobSchema = createInsertSchema(satVisualizerJobs).omit({
  createdAt: true,
});

export type SatVisualizerJob = typeof satVisualizerJobs.$inferSelect;
export type InsertSatVisualizerJob = z.infer<typeof insertSatVisualizerJobSchema>;
