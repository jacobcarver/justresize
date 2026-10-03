/**
 * URL presets: /?width=1200&height=630&format=webp
 *
 * Lets a link (or a tool landing page) open the app preconfigured. Every
 * value goes through Zod; anything unrecognised or out of range is ignored
 * rather than trusted. Settings are only ever READ from the URL — the app
 * never writes slider state back into it.
 */
import * as z from "zod/mini";
import { LIMITS } from "@/lib/config/limits";
import { parseByteString } from "@/lib/utils/bytes";
import type { TransformConfig } from "@/types";
import { outputFormatSchema, resizeFitSchema, targetStrategySchema } from "./schema";

const dimension = z.coerce.number().check(z.int(), z.minimum(1), z.maximum(LIMITS.maxOutputDimension));

/** A parameter that is simply dropped when missing or invalid, instead of failing the whole query. */
const lenient = <T extends z.ZodMiniType>(schema: T) => z.catch(z.optional(schema), undefined);

const querySchema = z.object({
  width: lenient(dimension),
  height: lenient(dimension),
  /** Fit within: "1600" or "1600x1200". */
  max: lenient(z.string().check(z.regex(/^\d{1,5}(x\d{1,5})?$/i))),
  percent: lenient(z.coerce.number().check(z.minimum(1), z.maximum(1000))),
  /** Target file size: "500kb", "2mb". */
  target: lenient(z.string().check(z.maxLength(16))),
  strategy: lenient(targetStrategySchema),
  fit: lenient(resizeFitSchema),
  format: lenient(z.union([outputFormatSchema, z.literal("jpg"), z.literal("source")])),
  /** 1–100, as shown in the UI. */
  quality: lenient(z.coerce.number().check(z.minimum(1), z.maximum(100))),
});

const QUERY_KEYS = Object.keys(querySchema.shape);

export function parseQueryConfig(params: URLSearchParams): Partial<TransformConfig> | null {
  const raw: Record<string, string> = {};
  for (const key of QUERY_KEYS) {
    const value = params.get(key);
    if (value !== null && value !== "") raw[key] = value;
  }
  if (Object.keys(raw).length === 0) return null;

  const parsed = z.safeParse(querySchema, raw);
  if (!parsed.success) return null;
  const query = parsed.data;
  const patch: Partial<TransformConfig> = {};

  if (query.width !== undefined || query.height !== undefined) {
    patch.resizeMode = "dimensions";
    patch.width = query.width;
    patch.height = query.height;
    patch.aspectRatio = undefined;
    // Both sides given means an exact box; one side means "keep the ratio".
    patch.maintainAspectRatio = !(query.width !== undefined && query.height !== undefined);
  } else if (query.max) {
    const [width, height] = query.max.toLowerCase().split("x").map(Number);
    const box = z.safeParse(dimension, width);
    const boxHeight = z.safeParse(dimension, height ?? width);
    if (box.success && boxHeight.success) {
      patch.resizeMode = "max-dimensions";
      patch.width = box.data;
      patch.height = boxHeight.data;
    }
  } else if (query.percent !== undefined) {
    patch.resizeMode = "percentage";
    patch.percentage = query.percent;
  }

  if (query.target) {
    const bytes = parseByteString(query.target);
    if (bytes !== null && bytes >= 1024) {
      patch.targetFileSize = { bytes, strategy: query.strategy ?? "smart" };
      if (!patch.resizeMode) patch.resizeMode = "target-filesize";
    }
  }

  if (query.fit) patch.fit = query.fit;
  if (query.format) patch.outputFormat = query.format === "jpg" ? "jpeg" : query.format;
  if (query.quality !== undefined) patch.quality = query.quality / 100;

  return Object.keys(patch).length > 0 ? patch : null;
}
