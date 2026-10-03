import { QUALITY_DEFAULT } from "@/lib/config/limits";
import { DEFAULT_NAMING } from "@/lib/files/naming";
import { DEFAULT_CROP } from "@/lib/image/geometry";
import { MB } from "@/lib/utils/bytes";
import type { TargetFileSize, TransformConfig } from "@/types";

/**
 * First-load behaviour: nothing surprising. Original dimensions until the
 * user asks for something else, the source's own format, ratio locked, crop
 * centred, metadata stripped.
 */
export const DEFAULT_CONFIG: TransformConfig = {
  resizeMode: "dimensions",
  width: undefined,
  height: undefined,
  percentage: 50,
  maintainAspectRatio: true,
  aspectRatio: undefined,
  fit: "cover",
  crop: { ...DEFAULT_CROP },
  background: { type: "transparent", color: "#ffffff" },
  outputFormat: "source",
  quality: QUALITY_DEFAULT,
  targetFileSize: undefined,
  metadata: { preserve: false },
  naming: { ...DEFAULT_NAMING },
};

export const DEFAULT_TARGET: TargetFileSize = { bytes: 1 * MB, strategy: "smart" };

export function createDefaultConfig(): TransformConfig {
  return structuredClone(DEFAULT_CONFIG);
}
