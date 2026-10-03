/**
 * Plain-language descriptions of a config, for summaries, saved presets and
 * output variants.
 */
import { OUTPUT_FORMATS } from "@/lib/image/formats";
import { isBoxed } from "@/lib/image/geometry";
import { formatBytes } from "@/lib/utils/bytes";
import type { OutputFormat, ResizeFit, TargetSizeStrategy, TransformConfig } from "@/types";

export const FIT_LABELS: Record<ResizeFit, string> = {
  cover: "Fill",
  contain: "Contain",
  stretch: "Stretch",
  inside: "Inside",
};

export const STRATEGY_LABELS: Record<TargetSizeStrategy, { label: string; description: string }> = {
  smart: { label: "Smart", description: "Lowers quality first, then shrinks dimensions only if needed." },
  "quality-only": { label: "Compress only", description: "Keeps dimensions and only lowers quality." },
  dimensions: { label: "Resize only", description: "Keeps your quality setting and shrinks dimensions." },
};

/** True when the file-size search chooses quality itself, so a quality control would be meaningless. */
export function qualityIsAutomatic(config: TransformConfig): boolean {
  return (
    config.resizeMode === "target-filesize" && !!config.targetFileSize && config.targetFileSize.strategy !== "dimensions"
  );
}

export function describeQuality(config: TransformConfig, format: OutputFormat): string | null {
  if (!OUTPUT_FORMATS[format].lossy) return null;
  const percent = Math.round(config.quality * 100);
  if (qualityIsAutomatic(config)) return "Quality automatic";
  if (config.targetFileSize && config.targetFileSize.strategy !== "dimensions") return `Quality up to ${percent}`;
  return `Quality ${percent}`;
}

function describeSize(config: TransformConfig): string {
  const { width, height, aspectRatio } = config;
  switch (config.resizeMode) {
    case "percentage":
      return `${config.percentage ?? 100}%`;
    case "max-dimensions":
      if (width && height) return `Fit within ${width} × ${height}`;
      return width ? `Max width ${width}` : `Max height ${height ?? "—"}`;
    case "target-filesize":
      return "Original size";
    case "dimensions": {
      const ratio = config.maintainAspectRatio && aspectRatio ? `${aspectRatio.w}:${aspectRatio.h}` : null;
      if (width && height) return `${width} × ${height}`;
      if (width) return ratio ? `${width} wide, ${ratio}` : `${width} wide`;
      if (height) return ratio ? `${height} tall, ${ratio}` : `${height} tall`;
      return ratio ? `${ratio} ratio` : "Original size";
    }
  }
}

/** One-line recipe, e.g. "1200 × 630 · Fill · WebP · Quality 82". */
export function describeTransform(config: TransformConfig): string {
  const parts = [describeSize(config)];
  if (isBoxed(config)) parts.push(FIT_LABELS[config.fit]);

  if (config.outputFormat === "source") {
    parts.push("Same format");
  } else {
    parts.push(OUTPUT_FORMATS[config.outputFormat].label);
    const quality = describeQuality(config, config.outputFormat);
    if (quality && !config.targetFileSize) parts.push(quality);
  }
  if (config.targetFileSize) parts.push(`Under ${formatBytes(config.targetFileSize.bytes)}`);
  return parts.join(" · ");
}
