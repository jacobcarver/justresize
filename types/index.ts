/**
 * Shared domain types. Everything here is plain data (serializable, worker-safe)
 * except where a type explicitly carries a File or Blob.
 */

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/* ------------------------------------------------------------------ */
/* Formats                                                             */
/* ------------------------------------------------------------------ */

/** Formats we can write. */
export type OutputFormat = "jpeg" | "png" | "webp" | "avif";

/** Formats we recognise on input (whether we can decode them is a runtime capability). */
export type SourceFormat = "jpeg" | "png" | "webp" | "avif" | "gif" | "heic";

/** "source" keeps each image in the format it arrived in, where that format can be written. */
export type OutputFormatSetting = OutputFormat | "source";

/* ------------------------------------------------------------------ */
/* Transform configuration                                             */
/* ------------------------------------------------------------------ */

export type ResizeMode =
  | "dimensions"
  | "percentage"
  | "max-dimensions"
  | "target-filesize";

export type ResizeFit = "contain" | "cover" | "stretch" | "inside";

/**
 * Crop placement for `cover`. `x`/`y` are a normalized focal point in source
 * space (0–1): the crop window is centred on it, then clamped to the image.
 * `zoom` ≥ 1 shrinks the crop window (zooms in). Normalized so the settings
 * survive any preview size and can later be supplied by a smart-crop detector.
 */
export interface CropSettings {
  x: number;
  y: number;
  zoom: number;
}

export interface BackgroundConfig {
  type: "transparent" | "color";
  /** #rrggbb. Used when `type` is "color", or when the output format has no alpha. */
  color: string;
}

export type TargetSizeStrategy = "quality-only" | "smart" | "dimensions";

export interface TargetFileSize {
  bytes: number;
  strategy: TargetSizeStrategy;
}

export interface NamingOptions {
  /** Tokens: {name} {width} {height} {format} {index} */
  pattern: string;
  lowercase?: boolean;
  replaceSpaces?: boolean;
  separator?: "-" | "_" | " ";
}

export interface AspectRatioSetting {
  w: number;
  h: number;
}

export interface TransformConfig {
  resizeMode: ResizeMode;

  /** Pixels. In "max-dimensions" mode these are upper bounds. Undefined = auto. */
  width?: number;
  height?: number;
  percentage?: number;

  /**
   * When true, one dimension drives and the other follows the ratio
   * (the source's own ratio, or `aspectRatio` when set).
   */
  maintainAspectRatio: boolean;
  /** Target ratio when locked. Undefined = each image's original ratio. */
  aspectRatio?: AspectRatioSetting;

  fit: ResizeFit;
  crop: CropSettings;
  background: BackgroundConfig;

  outputFormat: OutputFormatSetting;
  /** Normalized 0–1. Only meaningful for lossy formats. */
  quality: number;

  targetFileSize?: TargetFileSize;

  metadata: { preserve: boolean };
  naming: NamingOptions;
}

/** Multi-output: one source × N variants. */
export interface OutputVariant {
  id: string;
  name: string;
  transform: TransformConfig;
}

/* ------------------------------------------------------------------ */
/* Presets                                                             */
/* ------------------------------------------------------------------ */

export interface ResizePreset {
  id: string;
  category: string;
  label: string;
  width: number;
  height: number;
  fit?: ResizeFit;
  format?: OutputFormat;
}

/** A user-saved recipe: the whole transform config under a name. No image data. */
export interface SavedPreset {
  id: string;
  name: string;
  createdAt: number;
  config: TransformConfig;
}

/* ------------------------------------------------------------------ */
/* Assets                                                              */
/* ------------------------------------------------------------------ */

export type AssetStatus = "loading" | "ready" | "error";

export interface SourceImage {
  id: string;
  file: File;
  originalName: string;
  baseName: string;
  extension: string;
  mimeType: string;
  format?: SourceFormat;

  width: number;
  height: number;
  aspectRatio: number;
  fileSize: number;
  hasTransparency?: boolean;
  /** EXIF orientation (1–8) found in the file. */
  orientation?: number;

  /** Object URL of a small thumbnail (never the full-size original). */
  previewUrl: string;

  status: AssetStatus;
  error?: ProcessingError;

  /** Per-image overrides layered on top of the global config. */
  overrides?: Partial<TransformConfig>;
}

/* ------------------------------------------------------------------ */
/* Errors                                                              */
/* ------------------------------------------------------------------ */

export type ErrorCategory =
  | "unsupported_format"
  | "decode_failed"
  | "output_too_large"
  | "memory_limit"
  | "encoder_failed"
  | "target_unreachable"
  | "invalid_config"
  | "cancelled"
  | "unknown";

/** Serializable error: `message` is user-facing, `detail` is for the dev console only. */
export interface ProcessingError {
  category: ErrorCategory;
  message: string;
  detail?: string;
}

/* ------------------------------------------------------------------ */
/* Processing                                                          */
/* ------------------------------------------------------------------ */

export type ProcessingStage = "decoding" | "resizing" | "encoding";

export interface ProcessingTimings {
  decodeMs: number;
  resizeMs: number;
  encodeMs: number;
  totalMs: number;
  /** Time spent waiting for a free worker. Filled in by the queue. */
  queueMs?: number;
  encodeCount: number;
  worker?: string;
}

export interface ProcessedImage {
  blob: Blob;
  width: number;
  height: number;
  format: OutputFormat;
  fileSize: number;
  filename: string;
  processingTime: number;

  /** Quality actually used (0–1) for lossy formats. */
  qualityUsed?: number;
  /** Set when a file-size target forced smaller dimensions than requested. */
  resizedForTarget?: { from: Size; to: Size };
  /** Set when a file-size target was met by reducing a PNG to this many colours. */
  reducedColors?: number;
  timings: ProcessingTimings;
}

/** What the store keeps: everything but the heavy Blob. */
export type ProcessedImageMeta = Omit<ProcessedImage, "blob">;

export type JobState =
  | { status: "queued" }
  | { status: "processing"; stage: ProcessingStage }
  | { status: "complete"; result: ProcessedImageMeta }
  | { status: "error"; error: ProcessingError }
  | { status: "cancelled" };

export type JobStatus = JobState["status"];

export interface ProcessingJob {
  id: string;
  sourceId: string;
  variantId?: string;
  variantName?: string;
  /** Immutable snapshot taken when the job was queued. */
  configuration: TransformConfig;
  /** 1-based position in its batch, used by the {index} naming token. */
  index: number;
  /** Number of jobs in the batch, used to size {index} zero-padding. */
  batchSize: number;
  state: JobState;
}

/* ------------------------------------------------------------------ */
/* Capabilities                                                        */
/* ------------------------------------------------------------------ */

export interface BrowserCapabilities {
  offscreenCanvas: boolean;
  webWorkers: boolean;
  createImageBitmap: boolean;
  /** Native canvas encoders. */
  webpEncode: boolean;
  avifEncode: boolean;
}
