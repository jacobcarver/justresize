"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { AlertIcon, CheckIcon, DownloadIcon, Spinner } from "@/components/ui/icons";
import { Tooltip } from "@/components/ui/Tooltip";
import { batchBucket, track } from "@/lib/analytics";
import { FEATURES } from "@/lib/config/features";
import { type BatchStats, useBatchStats } from "@/lib/hooks";
import { downloadAll } from "@/lib/processing/export";
import { cancelAll, startBatch } from "@/lib/processing/queue";
import { sameConfig } from "@/lib/settings/compare";
import { validateConfig, validateForSource } from "@/lib/settings/validate";
import { shortcut } from "@/lib/utils/platform";
import { effectiveConfig, useAssetStore } from "@/stores/useAssetStore";
import { DEFAULT_SLOT, isActive, useProcessingStore } from "@/stores/useProcessingStore";
import { useSettingsStore } from "@/stores/useSettingsStore";

const plural = (count: number, noun: string) => `${count.toLocaleString("en-US")} ${noun}${count === 1 ? "" : "s"}`;

function finishedSummary(stats: BatchStats, noun: string): string {
  const parts = [`${plural(stats.complete, noun)} ready`];
  if (stats.failed > 0) parts.push(`${stats.failed} failed`);
  if (stats.cancelled > 0) parts.push(`${stats.cancelled} cancelled`);
  return parts.join(", ");
}

/** What pressing the button would do right now, and why it might not be possible. */
function useProcessPlan() {
  const assets = useAssetStore((state) => state.assets);
  const jobs = useProcessingStore((state) => state.jobs);
  const config = useSettingsStore((state) => state.config);
  const variants = useSettingsStore((state) => state.variants);

  return useMemo(() => {
    const usingVariants = FEATURES.multiOutput && variants.length > 0;
    const ready = assets.filter((asset) => asset.status === "ready");
    const loading = assets.some((asset) => asset.status === "loading");
    // Images already queued or processing are left alone, so only the rest count.
    const idle = ready.filter((asset) => !Object.values(jobs[asset.id] ?? {}).some(isActive));

    let reason: string | null = null;
    if (assets.length === 0) reason = "Add images to get started.";
    else if (ready.length === 0) reason = loading ? "Reading images…" : "None of these files can be processed.";
    else if (!usingVariants) {
      reason = validateConfig(config);
      if (!reason && idle.length > 0) {
        // Only block when no image can be processed; otherwise the few that cannot will fail individually with a clear message.
        const firstProblem = idle.map((asset) => validateForSource(asset, effectiveConfig(asset, config))).find(Boolean);
        const allBlocked = idle.every((asset) => validateForSource(asset, effectiveConfig(asset, config)) !== null);
        if (allBlocked) reason = firstProblem ?? null;
      }
    }

    // Compare each image's finished results with what a run would produce now:
    // "current" when every planned output already exists with these exact
    // settings, "outdated" when it has results made with different ones.
    const outputs = usingVariants
      ? variants.map((variant) => ({ slot: variant.id, transform: variant.transform }))
      : [{ slot: DEFAULT_SLOT, transform: config }];
    let outdated = 0;
    const pending: string[] = [];
    for (const asset of idle) {
      const slots = jobs[asset.id] ?? {};
      const upToDate = outputs.every(({ slot, transform }) => {
        const job = slots[slot];
        return job?.state.status === "complete" && sameConfig(job.configuration, effectiveConfig(asset, transform));
      });
      if (upToDate) continue;
      pending.push(asset.id);
      if (Object.values(slots).some((job) => job.state.status === "complete")) outdated += 1;
    }

    return {
      idleIds: idle.map((asset) => asset.id),
      /** The idle images that have no result for the settings on screen yet. */
      pendingIds: pending,
      reason,
      usingVariants,
      variantCount: variants.length,
      /** Every image that could be processed already has results for the settings on screen. */
      upToDate: idle.length > 0 && pending.length === 0,
      /** Images whose results were made with settings that have since changed. */
      outdated,
    };
  }, [assets, jobs, config, variants]);
}

/**
 * The primary action and its state. Docked at the foot of the inspector on
 * wide screens, fixed to the bottom edge on small ones.
 *
 * The main button follows the work: Resize while there is something to
 * resize, progress while it runs, Download once every image has a result
 * for the settings on screen — and back to Resize as soon as they change.
 */
export function ActionBar() {
  const stats = useBatchStats();
  const plan = useProcessPlan();
  const mode = useSettingsStore((state) => state.config.resizeMode);
  const hasAssets = useAssetStore((state) => state.assets.length > 0);
  const [zipProgress, setZipProgress] = useState<{ done: number; total: number } | null>(null);
  const [zipError, setZipError] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState(false);

  const running = stats.active > 0;
  const finished = stats.total - stats.active;
  // A normal run processes every image again. While a batch is running the
  // button only queues what the batch has not covered: newly added images,
  // cancelled ones, anything without a result for the settings on screen.
  const queueIds = running ? plan.pendingIds : plan.idleIds;
  const idleCount = queueIds.length;
  const canProcess = !plan.reason && idleCount > 0;
  const upToDate = !running && canProcess && plan.upToDate;
  const noun = plan.usingVariants ? "file" : "image";

  const process = () => {
    if (canProcess) startBatch(queueIds);
  };

  // Screen readers hear the outcome once a batch settles, not every step along the way.
  const announcement = zipError ?? (!running && stats.total > 0 ? `Finished. ${finishedSummary(stats, noun)}.` : "");

  // Ctrl/⌘ + Enter starts processing from anywhere on the page.
  const processRef = useRef(process);
  useEffect(() => {
    processRef.current = process;
  });
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && !event.repeat) {
        event.preventDefault();
        processRef.current();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!downloaded) return;
    const timer = setTimeout(() => setDownloaded(false), 1600);
    return () => clearTimeout(timer);
  }, [downloaded]);

  const download = async () => {
    try {
      setZipError(null);
      setZipProgress({ done: 0, total: stats.complete });
      const count = await downloadAll({ onProgress: (done, total) => setZipProgress({ done, total }) });
      if (count > 0) setDownloaded(true);
      if (count > 1) track({ name: "zip_downloaded", batchSize: batchBucket(count) });
    } catch {
      setZipError("The ZIP file couldn't be created. Try downloading the images one at a time.");
    } finally {
      setZipProgress(null);
    }
  };

  const verb = mode === "target-filesize" ? "Compress" : "Resize";
  // Finished results that no longer match the settings on screen: still downloadable, but named for what they are.
  const stale = !running && plan.outdated > 0;
  let label: string;
  if (running) label = idleCount > 0 ? `Add ${plural(idleCount, "image")} to queue` : "Processing…";
  else if (upToDate) label = `${verb} again`;
  else if (idleCount === 0) label = verb;
  else label = `${verb} ${plural(idleCount, "image")}`;

  const processButton = (
    <Tooltip label={shortcut("↵")} className={upToDate ? "shrink-0" : stale ? "w-full" : "min-w-0 flex-1"}>
      <Button
        variant={upToDate ? "secondary" : "primary"}
        size="lg"
        className="w-full"
        disabled={!canProcess}
        aria-describedby={plan.reason ? "process-reason" : undefined}
        onClick={process}
        data-testid="process-button"
      >
        {running && idleCount === 0 && <Spinner />}
        {label}
      </Button>
    </Tooltip>
  );

  const downloadButton = stats.complete > 0 && (
    <Button
      variant={upToDate ? "primary" : "secondary"}
      size={stale ? "md" : "lg"}
      className={upToDate ? "min-w-0 flex-1" : stale ? "w-full" : ""}
      disabled={!!zipProgress}
      onClick={() => void download()}
      data-testid="download-all"
    >
      {downloaded ? <CheckIcon /> : <DownloadIcon />}
      {zipProgress
        ? `Zipping ${zipProgress.done} of ${zipProgress.total}…`
        : downloaded
          ? "Downloaded"
          : stats.complete === 1
            ? stale
              ? "Download existing file"
              : "Download"
            : stale
              ? "Download existing ZIP"
              : "Download ZIP"}
    </Button>
  );

  return (
    <div
      className={`action-dock fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface-1 px-[max(1rem,env(safe-area-inset-left))] pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 lg:static lg:z-auto lg:block lg:shrink-0 lg:border-line-subtle lg:px-5 lg:py-4 ${
        hasAssets ? "" : "hidden"
      }`}
    >
      <div className="mx-auto flex max-w-[84rem] flex-col gap-2.5">
        {running && (
          <div>
            <div className="mb-1.5 flex items-center justify-between text-ui">
              <span className="font-mono text-xs text-fg-secondary" data-testid="progress-text">
                {finished} of {stats.total} done
              </span>
              <button
                type="button"
                onClick={cancelAll}
                className="rounded-control text-xs text-fg-secondary underline decoration-line-strong underline-offset-2 hover:text-fg touch:min-h-9"
              >
                Cancel all
              </button>
            </div>
            {/* Real progress: finished jobs over total jobs. No invented percentages. */}
            <div
              className="h-0.5 overflow-hidden rounded-full bg-surface-3"
              role="progressbar"
              aria-label="Batch progress"
              aria-valuemin={0}
              aria-valuemax={stats.total}
              aria-valuenow={finished}
            >
              <div className="h-full bg-accent-text transition-[width] duration-200" style={{ width: `${(finished / stats.total) * 100}%` }} />
            </div>
          </div>
        )}

        {!running && stats.total > 0 && (
          <p className="flex items-center gap-1.5 text-xs text-fg-secondary">
            {stale ? (
              <>
                <span className="size-1.5 shrink-0 rounded-full bg-warning" aria-hidden />
                Results use previous settings.
              </>
            ) : (
              <>
                {stats.complete > 0 && <CheckIcon width={14} height={14} className="shrink-0 text-success" />}
                {finishedSummary(stats, noun)}
              </>
            )}
          </p>
        )}

        {/* Side by side normally. With stale results the two stack, so Resize keeps its full width and leads. */}
        <div className={stale ? "flex flex-col gap-2" : "flex gap-2"}>
          {upToDate ? (
            <>
              {downloadButton}
              {processButton}
            </>
          ) : (
            <>
              {processButton}
              {downloadButton}
            </>
          )}
        </div>

        {plan.reason && hasAssets && (
          <p id="process-reason" className="flex items-start gap-1.5 text-xs text-danger" data-testid="process-reason">
            <AlertIcon width={14} height={14} className="mt-px shrink-0" />
            {plan.reason}
          </p>
        )}
        {plan.usingVariants && !plan.reason && (
          <p className="text-xs text-fg-tertiary">{plan.variantCount} outputs per image are set up under Advanced.</p>
        )}
        {running && <p className="hidden text-xs text-fg-tertiary lg:block">Settings changes apply to the next run, not the one in progress.</p>}

        {zipError && (
          <p className="text-xs text-danger" aria-hidden>
            {zipError}
          </p>
        )}
        <p className="sr-only" role="status" aria-live="polite">
          {announcement}
        </p>
      </div>
    </div>
  );
}
