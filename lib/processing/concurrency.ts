import { CONCURRENCY } from "@/lib/config/limits";

/**
 * How many images to process at once. Deliberately conservative: each job can
 * hold a decoded source (4 bytes per pixel) plus working canvases, so memory —
 * not CPU — is what kills tabs. Half the cores, never more than four.
 */
export function defaultConcurrency(hardwareConcurrency: number | undefined): number {
  const cores = Number.isFinite(hardwareConcurrency) && hardwareConcurrency! > 0 ? hardwareConcurrency! : 2;
  return Math.min(CONCURRENCY.maxWorkers, Math.max(1, Math.floor(cores / 2)));
}

/**
 * How many concurrency slots a job occupies. Very large sources count double
 * so that two 50 MP images are never decoded side by side with two more.
 * Operation complexity (e.g. multi-encode target-size jobs) can feed in here later.
 */
export function taskWeight(sourcePixels: number): number {
  return sourcePixels > CONCURRENCY.heavyPixels ? 2 : 1;
}

/** Steps concurrency down after a memory failure: 4 → 2 → 1. */
export function reducedConcurrency(current: number): number {
  return Math.max(1, Math.floor(current / 2));
}
