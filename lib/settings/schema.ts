/**
 * Runtime validation for anything that enters the app from outside the type
 * system: localStorage, saved presets, URL parameters.
 */
import * as z from "zod/mini";
import { LIMITS } from "@/lib/config/limits";
import { MAX_ZOOM } from "@/lib/image/geometry";
import { GB } from "@/lib/utils/bytes";
import type { TransformConfig } from "@/types";
import { createDefaultConfig } from "./defaults";

// zod/mini: the same validation as full Zod at a fraction of the bundle
// size, with checks written as functions instead of chained methods.
const dimension = z.int().check(z.minimum(1), z.maximum(LIMITS.maxOutputDimension));
const ratioPart = z.number().check(z.positive(), z.maximum(100_000));
const unit = z.number().check(z.minimum(0), z.maximum(1));

export const outputFormatSchema = z.enum(["jpeg", "png", "webp", "avif"]);
export const resizeFitSchema = z.enum(["contain", "cover", "stretch", "inside"]);
export const resizeModeSchema = z.enum(["dimensions", "percentage", "max-dimensions", "target-filesize"]);
export const targetStrategySchema = z.enum(["quality-only", "smart", "dimensions"]);

export const targetFileSizeSchema = z.object({
  bytes: z.int().check(z.minimum(1024), z.maximum(GB)),
  strategy: targetStrategySchema,
});

export const transformConfigSchema = z.object({
  resizeMode: resizeModeSchema,
  width: z.optional(dimension),
  height: z.optional(dimension),
  percentage: z.optional(z.number().check(z.minimum(1), z.maximum(1000))),
  maintainAspectRatio: z.boolean(),
  aspectRatio: z.optional(z.object({ w: ratioPart, h: ratioPart })),
  fit: resizeFitSchema,
  crop: z.object({
    x: unit,
    y: unit,
    zoom: z.number().check(z.minimum(1), z.maximum(MAX_ZOOM)),
  }),
  background: z.object({
    type: z.enum(["transparent", "color"]),
    color: z.string().check(z.regex(/^#[0-9a-fA-F]{6}$/)),
  }),
  outputFormat: z.union([outputFormatSchema, z.literal("source")]),
  quality: z.number().check(z.minimum(0.01), z.maximum(1)),
  targetFileSize: z.optional(targetFileSizeSchema),
  metadata: z.object({ preserve: z.boolean() }),
  naming: z.object({
    pattern: z.string().check(z.maxLength(200)),
    lowercase: z.optional(z.boolean()),
    replaceSpaces: z.optional(z.boolean()),
    separator: z.optional(z.enum(["-", "_", " "])),
  }),
});

/**
 * Best-effort recovery of a stored config. Fields that fail validation are
 * replaced by their defaults instead of throwing the whole object away, so a
 * single stale value never costs someone all their settings.
 */
export function sanitizeConfig(raw: unknown): TransformConfig {
  const defaults = createDefaultConfig();
  if (typeof raw !== "object" || raw === null) return defaults;

  const candidate: Record<string, unknown> = { ...defaults, ...(raw as Record<string, unknown>) };
  const first = z.safeParse(transformConfigSchema, candidate);
  if (first.success) return first.data;

  const fallback = defaults as unknown as Record<string, unknown>;
  for (const issue of first.error.issues) {
    const key = issue.path[0];
    if (typeof key === "string") candidate[key] = fallback[key];
  }
  const second = z.safeParse(transformConfigSchema, candidate);
  return second.success ? second.data : defaults;
}
