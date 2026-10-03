/**
 * The contract between the UI thread and the image engine. The same
 * requests are served by a Web Worker or, in compatibility mode, by the
 * engine running on the main thread.
 */
import type {
  BrowserCapabilities,
  ProcessedImage,
  ProcessingError,
  ProcessingStage,
  SourceFormat,
  TransformConfig,
} from "@/types";

/** What ingestion learned about a source, passed back in so it is not re-derived per job. */
export interface SourceInfo {
  format?: SourceFormat;
  hasTransparency?: boolean;
  orientation?: number;
}

/** Batch position, for the {index} naming token and its zero-padding. */
export interface NamingInput {
  index: number;
  total: number;
}

export interface InspectRequest {
  type: "inspect";
  file: File;
  thumbnailMaxEdge: number;
}

export interface PreviewRequest {
  type: "preview";
  file: File;
  maxEdge: number;
  source: SourceInfo;
}

export interface ProcessRequest {
  type: "process";
  file: File;
  config: TransformConfig;
  source: SourceInfo;
  naming: NamingInput;
  capabilities: BrowserCapabilities;
}

export type EngineRequest = InspectRequest | PreviewRequest | ProcessRequest;

export interface InspectResult {
  type: "inspect";
  format: SourceFormat;
  width: number;
  height: number;
  orientation: number;
  hasTransparency: boolean;
  thumbnail: Blob;
}

export interface PreviewResult {
  type: "preview";
  /** Downscaled, upright copy of the source. An ImageBitmap from a worker; a canvas in compatibility mode. */
  image: ImageBitmap | HTMLCanvasElement;
  width: number;
  height: number;
  /** Full-resolution source dimensions. */
  sourceWidth: number;
  sourceHeight: number;
}

export interface ProcessResult {
  type: "process";
  image: ProcessedImage;
}

export type EngineResult = InspectResult | PreviewResult | ProcessResult;

export type ResultFor<R extends EngineRequest> = Extract<EngineResult, { type: R["type"] }>;

export interface EngineHooks {
  signal?: AbortSignal;
  onStage?: (stage: ProcessingStage) => void;
}

/* Worker wire format ------------------------------------------------ */

export type ToWorkerMessage =
  | { kind: "run"; id: number; request: EngineRequest }
  | { kind: "cancel"; id: number };

export type FromWorkerMessage =
  | { kind: "stage"; id: number; stage: ProcessingStage }
  | { kind: "done"; id: number; result: EngineResult }
  | { kind: "failed"; id: number; error: ProcessingError };
