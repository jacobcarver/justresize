/**
 * Format knowledge as data. Whether a format can actually be decoded or
 * encoded in this browser is a separate, runtime question (see capabilities.ts).
 */
import { FEATURES } from "@/lib/config/features";
import type { BrowserCapabilities, OutputFormat, OutputFormatSetting, SourceFormat } from "@/types";

export interface OutputFormatInfo {
  id: OutputFormat;
  label: string;
  mimeType: string;
  extension: string;
  lossy: boolean;
  supportsTransparency: boolean;
}

export const OUTPUT_FORMATS: Record<OutputFormat, OutputFormatInfo> = {
  jpeg: { id: "jpeg", label: "JPEG", mimeType: "image/jpeg", extension: "jpg", lossy: true, supportsTransparency: false },
  png: { id: "png", label: "PNG", mimeType: "image/png", extension: "png", lossy: false, supportsTransparency: true },
  webp: { id: "webp", label: "WebP", mimeType: "image/webp", extension: "webp", lossy: true, supportsTransparency: true },
  avif: { id: "avif", label: "AVIF", mimeType: "image/avif", extension: "avif", lossy: true, supportsTransparency: true },
};

export const OUTPUT_FORMAT_IDS = Object.keys(OUTPUT_FORMATS) as OutputFormat[];

export interface SourceFormatInfo {
  id: SourceFormat;
  label: string;
  mimeTypes: string[];
  extensions: string[];
  canHaveTransparency: boolean;
}

export const SOURCE_FORMATS: Record<SourceFormat, SourceFormatInfo> = {
  jpeg: { id: "jpeg", label: "JPEG", mimeTypes: ["image/jpeg", "image/pjpeg"], extensions: ["jpg", "jpeg", "jfif"], canHaveTransparency: false },
  png: { id: "png", label: "PNG", mimeTypes: ["image/png"], extensions: ["png"], canHaveTransparency: true },
  webp: { id: "webp", label: "WebP", mimeTypes: ["image/webp"], extensions: ["webp"], canHaveTransparency: true },
  avif: { id: "avif", label: "AVIF", mimeTypes: ["image/avif"], extensions: ["avif"], canHaveTransparency: true },
  gif: { id: "gif", label: "GIF", mimeTypes: ["image/gif"], extensions: ["gif"], canHaveTransparency: true },
  heic: { id: "heic", label: "HEIC", mimeTypes: ["image/heic", "image/heif"], extensions: ["heic", "heif"], canHaveTransparency: false },
};

const SOURCE_FORMAT_LIST = Object.values(SOURCE_FORMATS);

export function sourceFormatFromMime(mimeType: string): SourceFormat | undefined {
  const mime = mimeType.toLowerCase();
  return SOURCE_FORMAT_LIST.find((f) => f.mimeTypes.includes(mime))?.id;
}

export function sourceFormatFromExtension(extension: string): SourceFormat | undefined {
  const ext = extension.toLowerCase().replace(/^\./, "");
  return SOURCE_FORMAT_LIST.find((f) => f.extensions.includes(ext))?.id;
}

/** `accept` attribute for the file picker. */
export const FILE_INPUT_ACCEPT = SOURCE_FORMAT_LIST.flatMap((f) => [
  ...f.mimeTypes,
  ...f.extensions.map((e) => `.${e}`),
]).join(",");

/** Which output formats this browser can produce, natively or through a WASM encoder. */
export function availableOutputFormats(capabilities: BrowserCapabilities): OutputFormat[] {
  return OUTPUT_FORMAT_IDS.filter((format) => canEncode(format, capabilities));
}

export function canEncode(format: OutputFormat, capabilities: BrowserCapabilities): boolean {
  switch (format) {
    case "jpeg":
    case "png":
      return true;
    case "webp":
      return capabilities.webpEncode || FEATURES.wasmWebp;
    case "avif":
      return FEATURES.avif;
  }
}

/**
 * Resolves the "same as source" setting to a concrete format.
 *
 * Sources we cannot write back in kind fall to the closest safe choice:
 * PNG when transparency must survive, JPEG otherwise. The UI shows the
 * resolved format before processing, so this is never a silent conversion.
 */
export function resolveOutputFormat(
  setting: OutputFormatSetting,
  source: { format?: SourceFormat; hasTransparency?: boolean },
  capabilities: BrowserCapabilities,
): OutputFormat {
  if (setting !== "source") return setting;
  const fallback: OutputFormat = source.hasTransparency ? "png" : "jpeg";
  switch (source.format) {
    case "jpeg":
      return "jpeg";
    case "png":
      return "png";
    case "webp":
      return canEncode("webp", capabilities) ? "webp" : fallback;
    case "avif":
      return canEncode("avif", capabilities) ? "avif" : fallback;
    case "gif":
      return "png";
    case "heic":
      return "jpeg";
    default:
      return fallback;
  }
}
