/**
 * Live validation of what the user has typed. Unlike the Zod schema (which
 * guards stored data), these return plain sentences for the UI and tolerate
 * half-entered values.
 */
import { LIMITS } from "@/lib/config/limits";
import { OUTPUT_FORMATS, resolveOutputFormat } from "@/lib/image/formats";
import { distortsAspectRatio, isBoxed, resolveOutputSize, validateOutputSize } from "@/lib/image/geometry";
import { formatBytes, KB } from "@/lib/utils/bytes";
import type { BrowserCapabilities, OutputFormat, Size, SourceImage, TransformConfig } from "@/types";

const numberFormat = new Intl.NumberFormat("en-US");

function dimensionProblem(label: string, value: number | undefined): string | null {
  if (value === undefined) return null;
  if (!Number.isFinite(value) || value < 1) return `${label} must be at least 1 px.`;
  if (!Number.isInteger(value)) return `${label} must be a whole number of pixels.`;
  if (value > LIMITS.maxOutputDimension) {
    return `${label} can be at most ${numberFormat.format(LIMITS.maxOutputDimension)} px.`;
  }
  return null;
}

/** Problems with the settings themselves, independent of any image. Null when fine. */
export function validateConfig(config: TransformConfig): string | null {
  if (config.resizeMode === "dimensions" || config.resizeMode === "max-dimensions") {
    const problem = dimensionProblem("Width", config.width) ?? dimensionProblem("Height", config.height);
    if (problem) return problem;

    if (config.width !== undefined && config.height !== undefined) {
      const sizeError = validateOutputSize({ width: config.width, height: config.height });
      if (sizeError) return sizeError.message;
    }
  }

  if (config.resizeMode === "max-dimensions" && config.width === undefined && config.height === undefined) {
    return "Enter a maximum width or height.";
  }

  if (config.resizeMode === "percentage") {
    const percentage = config.percentage;
    if (percentage === undefined || !Number.isFinite(percentage) || percentage <= 0) {
      return "Enter a percentage above 0.";
    }
    if (percentage > 1000) return "Percentage can be at most 1000%.";
  }

  if (config.resizeMode === "target-filesize" && !config.targetFileSize) {
    return "Enter a target file size.";
  }

  if (config.targetFileSize) {
    const { bytes } = config.targetFileSize;
    if (!Number.isFinite(bytes) || bytes < KB) return "Target file size must be at least 1 KB.";
  }

  if (config.maintainAspectRatio && config.aspectRatio) {
    const { w, h } = config.aspectRatio;
    if (!(w > 0 && h > 0)) return "Aspect ratio values must be above 0.";
  }

  return null;
}

/** Problems with applying the settings to one specific image. Null when fine. */
export function validateForSource(source: Size, config: TransformConfig): string | null {
  return validateOutputSize(resolveOutputSize(source, config))?.message ?? null;
}

export interface OutputSummary {
  size: Size;
  format: OutputFormat;
  /** Gentle heads-ups, not blockers. */
  warnings: string[];
}

/** What will happen to one image, for the "before → after" line shown ahead of processing. */
export function summarizeOutput(
  asset: Pick<SourceImage, "width" | "height" | "format" | "hasTransparency" | "fileSize">,
  config: TransformConfig,
  capabilities: BrowserCapabilities,
): OutputSummary {
  const size = resolveOutputSize(asset, config);
  const format = resolveOutputFormat(config.outputFormat, asset, capabilities);
  const warnings: string[] = [];

  if (size.width > asset.width || size.height > asset.height) {
    const padding = isBoxed(config) && config.fit === "contain";
    const enlarges = padding
      ? Math.min(size.width / asset.width, size.height / asset.height) > 1.001
      : true;
    if (enlarges) warnings.push("This image will be enlarged and may appear softer.");
  }

  if (distortsAspectRatio(asset, config)) {
    warnings.push("Stretch changes the aspect ratio, so the image will look distorted.");
  }

  if (asset.hasTransparency && !OUTPUT_FORMATS[format].supportsTransparency) {
    warnings.push(`${OUTPUT_FORMATS[format].label} has no transparency. Transparent areas will be filled with the background colour.`);
  }

  if (config.targetFileSize && config.targetFileSize.bytes >= asset.fileSize && config.resizeMode === "target-filesize" && format === asset.format) {
    warnings.push(`This image is already under ${formatBytes(config.targetFileSize.bytes)}.`);
  }

  return { size, format, warnings };
}
