/**
 * Privacy-safe product analytics seam. Off unless
 * NEXT_PUBLIC_ANALYTICS_ENABLED === "true" AND a sink has been registered,
 * so by default this does nothing at all.
 *
 * The event payload type is deliberately narrow: counts, buckets and
 * categories only. There is no way to pass a filename, a dimension, a hash
 * or any image data through it.
 */
import type { ErrorCategory, OutputFormat, ResizeMode } from "@/types";

export type AnalyticsEvent =
  /** The workspace opened, from /app itself or from one of the tool pages. */
  | { name: "tool_opened"; entry: "app" | "tool-page" }
  | { name: "files_added"; batchSize: BatchBucket }
  | { name: "resize_started"; batchSize: BatchBucket; mode: ResizeMode; outputFormat: OutputFormat | "source" }
  | { name: "resize_completed"; batchSize: BatchBucket; failed: number }
  | { name: "zip_downloaded"; batchSize: BatchBucket }
  | { name: "processing_failed"; category: ErrorCategory }
  /** A view of /token. Nothing about the visitor, and never an address or a copy action. */
  | { name: "token_page_viewed" };

export type BatchBucket = "1" | "2-10" | "11-50" | "51-200" | "200+";

export function batchBucket(count: number): BatchBucket {
  if (count <= 1) return "1";
  if (count <= 10) return "2-10";
  if (count <= 50) return "11-50";
  if (count <= 200) return "51-200";
  return "200+";
}

type Sink = (event: AnalyticsEvent) => void;

const enabled = process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === "true";
let sink: Sink | null = null;

/** Plug in a provider (e.g. from a client component). Without one, events go nowhere. */
export function setAnalyticsSink(next: Sink | null): void {
  sink = next;
}

export function track(event: AnalyticsEvent): void {
  if (!enabled || !sink) return;
  try {
    sink(event);
  } catch {
    // Analytics must never break the tool.
  }
}
