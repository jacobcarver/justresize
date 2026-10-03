/**
 * The image engine. Everything that touches pixels funnels through here, and
 * nothing in here touches React, stores or the DOM (beyond canvas), so the
 * same functions run inside a Web Worker, on the main thread as a fallback,
 * and could be reused by a future API or desktop shell.
 *
 *   Decoder   File → upright pixels            (decode.ts)
 *   Geometry  dimensions + config → RenderPlan (geometry.ts)
 *   Renderer  pixels + plan → canvas           (resize.ts)
 *   Encoder   canvas → Blob                    (encode.ts)
 *   Optimizer repeated encodes → target size   (target-file-size.ts)
 */
import { DEBUG } from "@/lib/config/features";
import { TARGET_SIZE_TUNING } from "@/lib/config/limits";
import { formatFilename, splitFilename } from "@/lib/files/naming";
import { checkSniffResult } from "@/lib/files/validation";
import type {
  EngineHooks,
  EngineRequest,
  InspectRequest,
  InspectResult,
  PreviewRequest,
  PreviewResult,
  ProcessRequest,
  ResultFor,
  SourceInfo,
} from "@/lib/processing/protocol";
import { formatBytes } from "@/lib/utils/bytes";
import type { BrowserCapabilities, OutputFormat, ProcessedImage, TransformConfig } from "@/types";
import { type AnyCanvas, canvasToBlob, getContext2D, releaseCanvas } from "./canvas";
import { type DecodedImage, decodeImage } from "./decode";
import { encodeCanvas, encodePalettePng } from "./encode";
import { ImageError, throwIfAborted } from "./errors";
import { OUTPUT_FORMATS, resolveOutputFormat, SOURCE_FORMATS } from "./formats";
import {
  calculateInside,
  computeRenderPlan,
  type RenderPlan,
  scaleRenderPlan,
  validateOutputSize,
  validateSourceSize,
} from "./geometry";
import { renderPlan } from "./resize";
import { sniffByteLength, sniffImage } from "./sniff";
import { compressToTarget, TargetUnreachableError } from "./target-file-size";
import { hasTransparentPixels, resolveBackground } from "./transparency";

const now = () => performance.now();

async function sniffFile(file: File) {
  const head = await file.slice(0, sniffByteLength(file)).arrayBuffer();
  return sniffImage(new Uint8Array(head));
}

function assertSourceSize(size: { width: number; height: number }): void {
  const error = validateSourceSize(size);
  if (error) throw error;
}

/** Plan that scales the whole source onto a canvas no larger than `maxEdge` on its longest side. */
function downscalePlan(decoded: DecodedImage, maxEdge: number): RenderPlan {
  const size = calculateInside(decoded, { width: maxEdge, height: maxEdge }, { allowUpscale: false });
  return {
    canvas: size,
    src: { x: 0, y: 0, width: decoded.width, height: decoded.height },
    dst: { x: 0, y: 0, width: size.width, height: size.height },
    padded: false,
    upscaled: false,
  };
}

/* ------------------------------------------------------------------ */
/* Inspect: validate, measure, thumbnail                               */
/* ------------------------------------------------------------------ */

export async function inspectImage(request: InspectRequest, hooks: EngineHooks = {}): Promise<InspectResult> {
  const { file } = request;
  throwIfAborted(hooks.signal);

  const sniff = await sniffFile(file);
  const rejection = checkSniffResult(sniff);
  if (rejection) throw rejection;
  const format = sniff.format!;
  // Reject oversized images from the header alone, before paying to decode them.
  if (sniff.width && sniff.height) assertSourceSize({ width: sniff.width, height: sniff.height });

  const orientation = sniff.orientation ?? 1;
  const decoded = await decodeImage(file, { format, orientation, signal: hooks.signal });
  let canvas: AnyCanvas | null = null;
  try {
    assertSourceSize(decoded);
    canvas = renderPlan(decoded.source, downscalePlan(decoded, request.thumbnailMaxEdge), {
      background: null,
      quality: "fast",
    });
    const hasTransparency =
      SOURCE_FORMATS[format].canHaveTransparency &&
      hasTransparentPixels(getContext2D(canvas), canvas.width, canvas.height);
    const thumbnail = await canvasToBlob(canvas, hasTransparency ? "image/png" : "image/jpeg", 0.8);
    throwIfAborted(hooks.signal);
    return {
      type: "inspect",
      format,
      width: decoded.width,
      height: decoded.height,
      orientation,
      hasTransparency,
      thumbnail,
    };
  } finally {
    decoded.close();
    releaseCanvas(canvas);
  }
}

/* ------------------------------------------------------------------ */
/* Preview: a modest upright bitmap for the interactive preview        */
/* ------------------------------------------------------------------ */

export async function createPreview(request: PreviewRequest, hooks: EngineHooks = {}): Promise<PreviewResult> {
  const decoded = await decodeImage(request.file, { ...request.source, signal: hooks.signal });
  let canvas: AnyCanvas | null = null;
  try {
    canvas = renderPlan(decoded.source, downscalePlan(decoded, request.maxEdge), { background: null, quality: "fast" });
    throwIfAborted(hooks.signal);
    const { width, height } = canvas;
    let image: ImageBitmap | HTMLCanvasElement;
    if ("transferToImageBitmap" in canvas) {
      image = canvas.transferToImageBitmap();
    } else {
      // Compatibility mode: hand over the canvas itself; the caller owns it now.
      image = canvas;
      canvas = null;
    }
    return { type: "preview", image, width, height, sourceWidth: decoded.width, sourceHeight: decoded.height };
  } finally {
    decoded.close();
    releaseCanvas(canvas);
  }
}

/* ------------------------------------------------------------------ */
/* Process: the real export                                            */
/* ------------------------------------------------------------------ */

export interface ProcessOptions extends EngineHooks {
  /** Facts already known about the source. Sniffed from the file when omitted. */
  source?: SourceInfo;
  /** Position in the batch for the {index} naming token. */
  index?: number;
  total?: number;
  capabilities?: BrowserCapabilities;
}

const ASSUMED_CAPABILITIES: BrowserCapabilities = {
  offscreenCanvas: true,
  webWorkers: true,
  createImageBitmap: true,
  webpEncode: true,
  avifEncode: false,
};

function targetUnreachableMessage(
  error: TargetUnreachableError,
  config: TransformConfig,
  format: OutputFormat,
): string {
  const target = formatBytes(error.targetBytes);
  const info = OUTPUT_FORMATS[format];
  const strategy = config.targetFileSize?.strategy;
  const smallest = Number.isFinite(error.smallestBytes) ? ` The smallest result was ${formatBytes(error.smallestBytes)}.` : "";

  if (strategy === "quality-only") {
    return `Unable to reach ${target} while preserving the selected format and dimensions.${smallest} Try the Smart option so dimensions can shrink too${info.lossy ? "" : ", or WebP or JPEG output"}.`;
  }
  return `Unable to reach ${target} even at very small dimensions.${smallest} Try a larger target${info.lossy ? "" : ", or WebP or JPEG output"}.`;
}

/**
 * Processes one image. Always works from the original file, never from a
 * previous output, so repeated runs do not accumulate quality loss.
 */
export async function processImage(
  file: File,
  config: TransformConfig,
  options: ProcessOptions = {},
): Promise<ProcessedImage> {
  const { signal, onStage } = options;
  const started = now();
  throwIfAborted(signal);

  onStage?.("decoding");
  let source = options.source;
  if (!source) {
    const sniff = await sniffFile(file);
    const rejection = checkSniffResult(sniff);
    if (rejection) throw rejection;
    source = { format: sniff.format, orientation: sniff.orientation };
  }

  const decodeStarted = now();
  const decoded = await decodeImage(file, { ...source, signal });
  const decodeMs = now() - decodeStarted;

  let resizeMs = 0;
  let encodeMs = 0;
  let encodeCount = 0;
  let rendered: { scale: number; canvas: AnyCanvas } | null = null;

  try {
    assertSourceSize(decoded);

    const plan = computeRenderPlan(decoded, config);
    const sizeError = validateOutputSize(plan.canvas);
    if (sizeError) throw sizeError;

    const format = resolveOutputFormat(config.outputFormat, source, options.capabilities ?? ASSUMED_CAPABILITIES);
    const info = OUTPUT_FORMATS[format];
    const background = resolveBackground(config.background, format);

    /** Renders at `scale` of the planned size, reusing the last canvas when the scale repeats. */
    const renderAt = (scale: number): AnyCanvas => {
      if (rendered?.scale === scale) return rendered.canvas;
      releaseCanvas(rendered?.canvas);
      rendered = null;
      const renderStarted = now();
      const canvas = renderPlan(decoded.source, scaleRenderPlan(plan, scale), { background, quality: "best" });
      resizeMs += now() - renderStarted;
      rendered = { scale, canvas };
      return canvas;
    };

    /** `colors` limits the palette (PNG only); the result says how many were kept if any were dropped. */
    const encodeAt = async (
      scale: number,
      quality: number | undefined,
      colors?: number,
    ): Promise<{ blob: Blob; reducedColors?: number }> => {
      const canvas = renderAt(scale);
      throwIfAborted(signal);
      const encodeStarted = now();
      let encoded: { blob: Blob; reducedColors?: number };
      if (colors === undefined) {
        encoded = { blob: await encodeCanvas(canvas, { format, quality }) };
      } else {
        const palette = await encodePalettePng(canvas, colors);
        encoded = { blob: palette.blob, reducedColors: palette.lossless ? undefined : palette.colors };
      }
      encodeMs += now() - encodeStarted;
      encodeCount += 1;
      throwIfAborted(signal);
      return encoded;
    };

    onStage?.("resizing");
    renderAt(1);
    throwIfAborted(signal);

    onStage?.("encoding");
    let blob: Blob;
    let width = plan.canvas.width;
    let height = plan.canvas.height;
    let qualityUsed = info.lossy ? config.quality : undefined;
    let resizedForTarget: ProcessedImage["resizedForTarget"];
    let reducedColors: number | undefined;

    const target = config.targetFileSize;
    if (target) {
      // In quick "make smaller than" mode the user never picked a quality,
      // so the search may go as high as looks worthwhile. Anywhere else the
      // chosen quality is a ceiling the file-size limit can only lower.
      const qualityIsAutomatic = config.resizeMode === "target-filesize" && target.strategy !== "dimensions";
      try {
        const result = await compressToTarget<{ blob: Blob; reducedColors?: number }>({
          targetBytes: target.bytes,
          strategy: target.strategy,
          lossy: info.lossy,
          reducibleColors: format === "png",
          dimensions: plan.canvas,
          maxQuality: qualityIsAutomatic ? TARGET_SIZE_TUNING.maxQuality : config.quality,
          signal,
          encode: async (scale, quality, colors) => {
            const payload = await encodeAt(scale, quality, colors);
            return { size: payload.blob.size, payload };
          },
        });
        blob = result.payload.blob;
        reducedColors = result.payload.reducedColors;
        width = result.width;
        height = result.height;
        qualityUsed = result.qualityUsed;
        if (result.resizedForTarget) {
          resizedForTarget = { from: { ...plan.canvas }, to: { width, height } };
        }
      } catch (error) {
        if (error instanceof TargetUnreachableError) {
          throw new ImageError("target_unreachable", targetUnreachableMessage(error, config, format), error.message);
        }
        throw error;
      }
    } else {
      blob = (await encodeAt(1, qualityUsed)).blob;
    }

    // Result integrity: never report success just because the encoder returned something.
    if (blob.size === 0) {
      throw new ImageError("encoder_failed", `Creating the ${info.label} file failed.`, "Encoder returned an empty blob");
    }
    if (blob.type !== info.mimeType) {
      throw new ImageError("encoder_failed", `Creating the ${info.label} file failed.`, `Expected ${info.mimeType}, got ${blob.type}`);
    }
    if (target && blob.size > target.bytes) {
      throw new ImageError("target_unreachable", `Unable to reach ${formatBytes(target.bytes)}.`, "Optimizer returned an oversized result");
    }

    const totalMs = now() - started;
    const result: ProcessedImage = {
      blob,
      width,
      height,
      format,
      fileSize: blob.size,
      filename: formatFilename(config.naming, {
        name: splitFilename(file.name).baseName,
        width,
        height,
        format,
        index: options.index ?? 1,
        total: options.total ?? 1,
      }),
      processingTime: totalMs,
      qualityUsed,
      resizedForTarget,
      reducedColors,
      timings: { decodeMs, resizeMs, encodeMs, totalMs, encodeCount },
    };

    if (DEBUG) {
      // Dimensions and timings only — never filenames or pixel data.
      console.debug(
        `[engine] ${decoded.width}×${decoded.height} → ${width}×${height} ${format} ` +
          `decode ${decodeMs.toFixed(0)}ms, resize ${resizeMs.toFixed(0)}ms, ` +
          `encode ${encodeMs.toFixed(0)}ms ×${encodeCount}, total ${totalMs.toFixed(0)}ms`,
      );
    }
    return result;
  } finally {
    decoded.close();
    releaseCanvas((rendered as { canvas: AnyCanvas } | null)?.canvas);
  }
}

/* ------------------------------------------------------------------ */
/* Dispatcher                                                          */
/* ------------------------------------------------------------------ */

function runProcess(request: ProcessRequest, hooks: EngineHooks) {
  return processImage(request.file, request.config, {
    ...hooks,
    source: request.source,
    index: request.naming.index,
    total: request.naming.total,
    capabilities: request.capabilities,
  }).then((image) => ({ type: "process" as const, image }));
}

export async function runEngineRequest<R extends EngineRequest>(request: R, hooks: EngineHooks = {}): Promise<ResultFor<R>> {
  switch (request.type) {
    case "inspect":
      return (await inspectImage(request, hooks)) as ResultFor<R>;
    case "preview":
      return (await createPreview(request, hooks)) as ResultFor<R>;
    case "process":
      return (await runProcess(request, hooks)) as ResultFor<R>;
    default:
      throw new ImageError("unknown", "Unsupported request.");
  }
}
