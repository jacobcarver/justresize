/**
 * The job queue: turns "process these images with these settings" into jobs,
 * feeds them to the engine pool, and mirrors their progress into the store.
 *
 * Heavy data stays out of React: result Blobs live in the `blobs` map here,
 * and the store only holds their metadata.
 */
import { batchBucket, track } from "@/lib/analytics";
import { DEBUG, FEATURES } from "@/lib/config/features";
import { detectCapabilities } from "@/lib/image/capabilities";
import { toProcessingError } from "@/lib/image/errors";
import { createId } from "@/lib/utils/id";
import { effectiveConfig, useAssetStore } from "@/stores/useAssetStore";
import { allJobs, DEFAULT_SLOT, isActive, slotOf, useProcessingStore } from "@/stores/useProcessingStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import type { ProcessingJob, SourceImage, TransformConfig } from "@/types";
import { reducedConcurrency, taskWeight } from "./concurrency";
import { getEnginePool } from "./runtime";

const controllers = new Map<string, AbortController>();
const blobs = new Map<string, Blob>();

export function getResultBlob(jobId: string): Blob | undefined {
  return blobs.get(jobId);
}

interface PlannedOutput {
  variantId?: string;
  variantName?: string;
  transform: TransformConfig;
}

/** One output per variant when multi-output is in use, otherwise the single global config. */
function plannedOutputs(): PlannedOutput[] {
  const { config, variants } = useSettingsStore.getState();
  if (FEATURES.multiOutput && variants.length > 0) {
    return variants.map((variant) => ({ variantId: variant.id, variantName: variant.name, transform: variant.transform }));
  }
  return [{ transform: config }];
}

/**
 * Queues every ready image (or just `assetIds`) with the CURRENT settings.
 *
 * Each job gets its own deep copy of the config, so changing settings while
 * a batch runs only affects jobs queued afterwards. Images that are already
 * queued or processing are left alone rather than queued twice.
 */
export function startBatch(assetIds?: string[]): number {
  const { assets } = useAssetStore.getState();
  const processing = useProcessingStore.getState();
  const outputs = plannedOutputs();
  const wanted = assetIds ? new Set(assetIds) : null;

  const targets = assets.filter((asset) => asset.status === "ready" && (!wanted || wanted.has(asset.id)));
  const newSlots = new Set(outputs.map((output) => output.variantId ?? DEFAULT_SLOT));

  const jobs: { job: ProcessingJob; asset: SourceImage }[] = [];
  const stale: ProcessingJob[] = [];

  targets.forEach((asset, position) => {
    const existing = processing.jobs[asset.id] ?? {};

    // Results from a different output setup (e.g. before variants were added) no longer apply.
    for (const [slot, job] of Object.entries(existing)) {
      if (!newSlots.has(slot) && !isActive(job)) stale.push(job);
    }

    for (const output of outputs) {
      const previous = existing[output.variantId ?? DEFAULT_SLOT];
      if (previous && isActive(previous)) continue;
      if (previous) blobs.delete(previous.id);

      jobs.push({
        asset,
        job: {
          id: createId("job"),
          sourceId: asset.id,
          variantId: output.variantId,
          variantName: output.variantName,
          configuration: structuredClone(effectiveConfig(asset, output.transform)),
          index: position + 1,
          batchSize: targets.length,
          state: { status: "queued" },
        },
      });
    }
  });

  for (const job of stale) blobs.delete(job.id);
  if (stale.length > 0) processing.removeJobs(stale);
  if (jobs.length === 0) return 0;

  processing.putJobs(jobs.map((entry) => entry.job));
  for (const { job, asset } of jobs) run(job, asset);

  const { config } = useSettingsStore.getState();
  track({
    name: "resize_started",
    batchSize: batchBucket(jobs.length),
    mode: config.resizeMode,
    outputFormat: config.outputFormat,
  });
  return jobs.length;
}

function run(job: ProcessingJob, asset: SourceImage): void {
  const store = useProcessingStore.getState();
  const slot = slotOf(job);
  const controller = new AbortController();
  controllers.set(job.id, controller);

  const queuedAt = performance.now();
  let startedAt = queuedAt;
  let worker: string | undefined;
  const pool = getEnginePool();

  pool
    .run(
      {
        type: "process",
        file: asset.file,
        config: job.configuration,
        source: { format: asset.format, hasTransparency: asset.hasTransparency, orientation: asset.orientation },
        naming: { index: job.index, total: job.batchSize },
        capabilities: detectCapabilities(),
      },
      {
        signal: controller.signal,
        weight: taskWeight(asset.width * asset.height),
        onStart: (label) => {
          startedAt = performance.now();
          worker = label;
        },
        onStage: (stage) => store.setJobState(job.sourceId, slot, job.id, { status: "processing", stage }),
      },
    )
    .then(({ image }) => {
      const { blob, ...meta } = image;
      // The slot may have been replaced or the image removed while this ran.
      const current = useProcessingStore.getState().jobs[job.sourceId]?.[slot];
      if (!current || current.id !== job.id || controller.signal.aborted) return;

      meta.timings = { ...meta.timings, queueMs: startedAt - queuedAt, worker };
      blobs.set(job.id, blob);
      store.setJobState(job.sourceId, slot, job.id, { status: "complete", result: meta });
    })
    .catch((error: unknown) => {
      const failure = toProcessingError(error);
      if (failure.category === "cancelled") {
        store.setJobState(job.sourceId, slot, job.id, { status: "cancelled" });
        return;
      }
      if (DEBUG) console.warn(`[queue] job failed (${failure.category})`, failure.detail ?? failure.message);
      store.setJobState(job.sourceId, slot, job.id, { status: "error", error: failure });
      track({ name: "processing_failed", category: failure.category });

      // Low-memory devices: back off so the rest of the batch has room.
      if (failure.category === "memory_limit" && pool.concurrency > 1) {
        pool.setConcurrency(reducedConcurrency(pool.concurrency));
      }
    })
    .finally(() => {
      controllers.delete(job.id);
      announceIfBatchFinished();
    });
}

function announceIfBatchFinished(): void {
  const jobs = allJobs(useProcessingStore.getState().jobs);
  if (jobs.length === 0 || jobs.some(isActive)) return;
  track({
    name: "resize_completed",
    batchSize: batchBucket(jobs.length),
    failed: jobs.filter((job) => job.state.status === "error").length,
  });
}

export function cancelJob(job: ProcessingJob): void {
  if (!isActive(job)) return;
  // Reflect it immediately; the pool/worker catches up asynchronously.
  useProcessingStore.getState().setJobState(job.sourceId, slotOf(job), job.id, { status: "cancelled" });
  controllers.get(job.id)?.abort();
}

export function cancelAll(): void {
  for (const job of allJobs(useProcessingStore.getState().jobs)) cancelJob(job);
}

/** Re-runs a failed or cancelled job with the same settings snapshot it had. */
export function retryJob(job: ProcessingJob): void {
  const asset = useAssetStore.getState().assets.find((candidate) => candidate.id === job.sourceId);
  if (!asset || asset.status !== "ready" || isActive(job)) return;
  blobs.delete(job.id);
  const retry: ProcessingJob = { ...job, id: createId("job"), state: { status: "queued" } };
  useProcessingStore.getState().putJobs([retry]);
  run(retry, asset);
}

/** Drops finished, failed and cancelled jobs (and their Blobs). Running jobs continue. */
export function clearResults(): void {
  const store = useProcessingStore.getState();
  const finished = allJobs(store.jobs).filter((job) => !isActive(job));
  for (const job of finished) blobs.delete(job.id);
  store.removeJobs(finished);
}

/** Cancels and forgets everything belonging to the given images. */
export function discardJobsForSources(sourceIds: string[]): void {
  const store = useProcessingStore.getState();
  for (const sourceId of sourceIds) {
    for (const job of Object.values(store.jobs[sourceId] ?? {})) {
      controllers.get(job.id)?.abort();
      blobs.delete(job.id);
    }
  }
  store.removeSources(sourceIds);
}
