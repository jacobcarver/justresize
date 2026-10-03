"use client";

import { memo, useEffect, useRef, useState } from "react";
import { Button, IconButton } from "@/components/ui/Button";
import { Dim } from "@/components/ui/Dim";
import { AlertIcon, ArrowRightIcon, CheckIcon, CloseIcon, CropIcon, DownloadIcon, RetryIcon, Spinner } from "@/components/ui/icons";
import { FEATURES } from "@/lib/config/features";
import { type BatchStats, useBatchStats } from "@/lib/hooks";
import { OUTPUT_FORMATS, SOURCE_FORMATS } from "@/lib/image/formats";
import { downloadJob } from "@/lib/processing/export";
import { clearAssets, removeAssets } from "@/lib/processing/ingest";
import { cancelJob, clearResults, retryJob } from "@/lib/processing/queue";
import { formatBytes, formatSizeChange } from "@/lib/utils/bytes";
import { useAssetStore } from "@/stores/useAssetStore";
import { useProcessingStore } from "@/stores/useProcessingStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import type { ProcessingJob, ProcessingStage, SourceImage } from "@/types";

const STAGE_LABELS: Record<ProcessingStage, string> = {
  decoding: "Reading",
  resizing: "Resizing",
  encoding: "Compressing",
};

const NO_JOBS: Record<string, ProcessingJob> = {};

const plural = (count: number, noun: string) => `${count.toLocaleString("en-US")} ${noun}${count === 1 ? "" : "s"}`;

const quietLink = "relative z-10 rounded-control text-fg-secondary underline decoration-line-strong underline-offset-2 hover:text-fg";

/** True for a moment after `trigger()`, for brief "it happened" feedback on a button. */
function useFlash(duration = 1600): [boolean, () => void] {
  const [on, setOn] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const trigger = () => {
    setOn(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOn(false), duration);
  };
  return [on, trigger];
}

function DownloadButton({ job, filename }: { job: ProcessingJob; filename: string }) {
  const [downloaded, flash] = useFlash();
  return (
    <Button
      variant="ghost"
      size="sm"
      className="relative z-10"
      onClick={() => {
        if (downloadJob(job)) flash();
      }}
      aria-label={`Download ${filename}`}
    >
      {downloaded ? <CheckIcon width={14} height={14} className="text-success" /> : <DownloadIcon width={14} height={14} />}
      <span className="hidden @2xl:inline">{downloaded ? "Downloaded" : "Download"}</span>
    </Button>
  );
}

/** One output of one image: where it is in the queue, or what it became. */
function JobLine({ job, asset }: { job: ProcessingJob; asset: SourceImage }) {
  const { state } = job;
  const variant = job.variantName ? <span className="font-sans font-medium text-fg">{job.variantName} </span> : null;

  let info: React.ReactNode;
  let action: React.ReactNode = null;

  switch (state.status) {
    case "queued":
      info = <p className="text-fg-tertiary">{variant}Queued</p>;
      action = (
        <button type="button" className={quietLink} onClick={() => cancelJob(job)}>
          Cancel
        </button>
      );
      break;

    case "processing":
      info = (
        <p className="flex items-center gap-2 text-fg-secondary">
          <Spinner className="text-accent-text" />
          <span>
            {variant}
            {STAGE_LABELS[state.stage]}…
          </span>
        </p>
      );
      action = (
        <button type="button" className={quietLink} onClick={() => cancelJob(job)}>
          Cancel
        </button>
      );
      break;

    case "complete": {
      const { result } = state;
      const grew = result.fileSize > asset.fileSize;
      info = (
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-2 font-mono text-fg">
            <CheckIcon width={14} height={14} className="shrink-0 text-success" />
            <span className="sr-only">Done.</span>
            {variant}
            <Dim size={result} /> <span>{OUTPUT_FORMATS[result.format].label}</span> <span>{formatBytes(result.fileSize)}</span>
          </p>
          <p className={`pl-[1.375rem] ${grew ? "text-warning" : "text-fg-secondary"}`}>{formatSizeChange(asset.fileSize, result.fileSize)}</p>
          {result.resizedForTarget && (
            <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 pl-[1.375rem] text-fg-tertiary">
              Target file size required reducing dimensions from <Dim size={result.resizedForTarget.from} /> to{" "}
              <Dim size={result.resizedForTarget.to} />.
            </p>
          )}
          {result.reducedColors !== undefined && (
            <p className="mt-0.5 pl-[1.375rem] text-fg-tertiary">
              Target file size required reducing the image to {result.reducedColors} colours.
            </p>
          )}
        </div>
      );
      action = <DownloadButton job={job} filename={result.filename} />;
      break;
    }

    case "error":
      info = (
        <p className="flex items-start gap-2 text-danger" role="alert">
          <AlertIcon width={14} height={14} className="mt-0.5 shrink-0" />
          <span>
            {variant}
            {state.error.message}
          </span>
        </p>
      );
      action = (
        <Button variant="ghost" size="sm" className="relative z-10" onClick={() => retryJob(job)} aria-label={`Retry ${asset.originalName}`}>
          <RetryIcon width={14} height={14} />
          Retry
        </Button>
      );
      break;

    case "cancelled":
      info = <p className="text-fg-tertiary">{variant}Cancelled</p>;
      action = (
        <Button variant="ghost" size="sm" className="relative z-10" onClick={() => retryJob(job)} aria-label={`Retry ${asset.originalName}`}>
          <RetryIcon width={14} height={14} />
          Retry
        </Button>
      );
      break;
  }

  return (
    <div className="flex items-start justify-between gap-3 text-xs" data-testid="job" data-status={state.status}>
      <div className="min-w-0 py-1">{info}</div>
      <div className="flex min-h-7 shrink-0 items-center">{action}</div>
    </div>
  );
}

const AssetRow = memo(function AssetRow({ asset, selected }: { asset: SourceImage; selected: boolean }) {
  const jobs = useProcessingStore((state) => state.jobs[asset.id] ?? NO_JOBS);
  const jobList = Object.values(jobs);
  const selectable = asset.status === "ready";

  return (
    <li
      className={`asset-row group relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 border-b border-line-subtle py-2 pl-3 pr-1 transition-colors duration-150 @2xl:grid-cols-[auto_minmax(0,1fr)_minmax(0,24rem)_auto] ${
        selected ? "bg-accent-subtle" : selectable ? "hover:bg-surface-hover" : ""
      }`}
      data-testid="asset-row"
      data-asset-id={asset.id}
      data-status={asset.status}
    >
      {/* A marker on the edge says which image the preview is showing. */}
      {selected && <span className="absolute inset-y-0 left-0 w-0.5 bg-accent-text" aria-hidden />}

      {/* The thumbnail is the select button; its hit area is stretched over the whole row. */}
      <button
        type="button"
        disabled={!selectable}
        onClick={() => useAssetStore.getState().select(asset.id)}
        aria-pressed={selected}
        aria-label={`Preview ${asset.originalName}`}
        className="checkerboard size-10 shrink-0 overflow-hidden rounded-[5px] after:absolute after:inset-0 disabled:cursor-default"
      >
        {asset.previewUrl ? (
          // A blob: thumbnail generated locally; next/image has nothing to optimise here.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={asset.previewUrl} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
        ) : (
          <span className="flex size-full items-center justify-center bg-surface-2 text-fg-tertiary">
            {asset.status === "loading" ? <Spinner /> : <AlertIcon />}
          </span>
        )}
      </button>

      <div className={`min-w-0 py-0.5 ${jobList.length === 0 ? "@2xl:col-span-2" : ""}`}>
        <p className="flex items-center gap-1.5 text-ui font-medium" title={asset.originalName}>
          <span className="truncate">{asset.originalName}</span>
          {asset.overrides?.crop && (
            <span className="shrink-0 text-fg-tertiary" title="This image has its own crop">
              <CropIcon width={12} height={12} />
              <span className="sr-only">Has its own crop</span>
            </span>
          )}
        </p>
        {asset.status === "ready" && (
          <p className="flex flex-wrap gap-x-2 font-mono text-xs text-fg-tertiary">
            <Dim size={asset} /> <span>{asset.format ? SOURCE_FORMATS[asset.format].label : ""}</span>{" "}
            <span>{formatBytes(asset.fileSize)}</span>
          </p>
        )}
        {asset.status === "loading" && <p className="text-xs text-fg-tertiary">Reading…</p>}
        {asset.status === "error" && (
          <p className="flex items-start gap-1.5 text-xs text-danger" role="alert">
            <AlertIcon width={14} height={14} className="mt-px shrink-0" />
            <span>{asset.error?.message ?? "This file couldn't be read as an image."}</span>
          </p>
        )}
      </div>

      {/* Results sit beside the original on wide rows and wrap underneath on narrow ones. */}
      {jobList.length > 0 && (
        <div className="order-last col-span-2 col-start-2 flex min-w-0 flex-col @2xl:order-none @2xl:col-span-1 @2xl:col-start-3">
          {jobList.map((job) => (
            <JobLine key={job.id} job={job} asset={asset} />
          ))}
        </div>
      )}

      <IconButton label={`Remove ${asset.originalName}`} className="row-reveal relative z-10 mt-1.5 touch:mt-0" onClick={() => removeAssets([asset.id])}>
        <CloseIcon width={14} height={14} />
      </IconButton>
    </li>
  );
});

function summaryText(stats: BatchStats, noun: string): string {
  const parts = [`${plural(stats.complete, noun)} ready`];
  if (stats.failed > 0) parts.push(`${stats.failed} failed`);
  if (stats.cancelled > 0) parts.push(`${stats.cancelled} cancelled`);
  return parts.join(", ");
}

/** Removing every image throws away the whole session, so it asks once before it does. */
function RemoveAllButton({ count }: { count: number }) {
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(false), 4000);
    return () => clearTimeout(timer);
  }, [confirming]);

  if (confirming) {
    return (
      <Button variant="danger" size="sm" autoFocus onBlur={() => setConfirming(false)} onClick={clearAssets}>
        Remove {plural(count, "image")}
      </Button>
    );
  }
  return (
    <Button variant="ghost" size="sm" onClick={() => (count > 1 ? setConfirming(true) : clearAssets())}>
      Remove all
    </Button>
  );
}

/** The queue's heading doubles as the batch summary: what is loaded, what came out, and the two ways to clear it. */
function QueueHeader() {
  const stats = useBatchStats();
  const count = useAssetStore((state) => state.assets.length);
  const usingVariants = useSettingsStore((state) => FEATURES.multiOutput && state.variants.length > 0);
  const running = stats.active > 0;
  const finished = stats.total - stats.active;
  const settled = !running && stats.total > 0;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pb-2">
      <h2 className="flex items-baseline gap-2 text-ui font-semibold">
        Files <span className="font-mono text-xs font-normal text-fg-tertiary">{count.toLocaleString("en-US")}</span>
      </h2>

      {settled && (
        <p className="flex flex-wrap items-center gap-x-3 text-xs text-fg-secondary" data-testid="batch-summary">
          <span className="flex items-center gap-1.5 text-fg">
            {stats.complete > 0 && <CheckIcon width={14} height={14} className="text-success" />}
            {summaryText(stats, usingVariants ? "file" : "image")}
          </span>
          {stats.complete > 0 && (
            <>
              <span className="flex items-center gap-1.5 font-mono">
                {formatBytes(stats.originalBytes)}
                <ArrowRightIcon width={12} height={12} className="text-fg-tertiary" />
                <span className="sr-only">to</span>
                {formatBytes(stats.outputBytes)}
              </span>
              <span>{formatSizeChange(stats.originalBytes, stats.outputBytes)}</span>
            </>
          )}
        </p>
      )}

      <div className="-mr-1 ml-auto flex items-center">
        <Button variant="ghost" size="sm" disabled={finished === 0} onClick={clearResults}>
          Clear results
        </Button>
        <RemoveAllButton count={count} />
      </div>
    </div>
  );
}

export function AssetList() {
  const assets = useAssetStore((state) => state.assets);
  const selectedId = useAssetStore((state) => state.selectedId);

  return (
    <section aria-label="Images" className="@container min-w-0">
      <QueueHeader />
      <ul
        className="border-t border-line-subtle"
        onKeyDown={(event) => {
          // Delete removes the image whose row has focus, unless typing somewhere.
          if (event.key !== "Delete") return;
          const row = (event.target as HTMLElement).closest<HTMLElement>("[data-asset-id]");
          if (row?.dataset.assetId) removeAssets([row.dataset.assetId]);
        }}
      >
        {assets.map((asset) => (
          <AssetRow key={asset.id} asset={asset} selected={asset.id === selectedId} />
        ))}
      </ul>
    </section>
  );
}
