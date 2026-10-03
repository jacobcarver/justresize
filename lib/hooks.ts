"use client";

import { useMemo } from "react";
import { detectCapabilities } from "@/lib/image/capabilities";
import { effectiveConfig, useAssetStore } from "@/stores/useAssetStore";
import { allJobs, isActive, useProcessingStore } from "@/stores/useProcessingStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import type { BrowserCapabilities, SourceImage, TransformConfig } from "@/types";

/** Only call from client-only components (everything under Workspace is). */
export function useCapabilities(): BrowserCapabilities {
  return detectCapabilities();
}

export function useSelectedAsset(): SourceImage | undefined {
  return useAssetStore((state) => state.assets.find((asset) => asset.id === state.selectedId));
}

/** The selected image when it is ready to use, with the config that applies to it. */
export function useSelectedContext(): { asset: SourceImage | undefined; config: TransformConfig } {
  const selected = useSelectedAsset();
  const globalConfig = useSettingsStore((state) => state.config);
  const asset = selected?.status === "ready" ? selected : undefined;
  const config = useMemo(() => (asset ? effectiveConfig(asset, globalConfig) : globalConfig), [asset, globalConfig]);
  return { asset, config };
}

export interface BatchStats {
  total: number;
  queued: number;
  processing: number;
  complete: number;
  failed: number;
  cancelled: number;
  active: number;
  /** Combined size of the originals that have a completed output, and of those outputs. */
  originalBytes: number;
  outputBytes: number;
}

export function useBatchStats(): BatchStats {
  const jobs = useProcessingStore((state) => state.jobs);
  const assets = useAssetStore((state) => state.assets);

  return useMemo(() => {
    const sizes = new Map(assets.map((asset) => [asset.id, asset.fileSize]));
    const stats: BatchStats = {
      total: 0,
      queued: 0,
      processing: 0,
      complete: 0,
      failed: 0,
      cancelled: 0,
      active: 0,
      originalBytes: 0,
      outputBytes: 0,
    };
    // With several variants per image, each original still only counts once.
    const counted = new Set<string>();
    for (const job of allJobs(jobs)) {
      stats.total += 1;
      if (isActive(job)) stats.active += 1;
      switch (job.state.status) {
        case "queued":
          stats.queued += 1;
          break;
        case "processing":
          stats.processing += 1;
          break;
        case "complete":
          stats.complete += 1;
          if (!counted.has(job.sourceId)) {
            counted.add(job.sourceId);
            stats.originalBytes += sizes.get(job.sourceId) ?? 0;
          }
          stats.outputBytes += job.state.result.fileSize;
          break;
        case "error":
          stats.failed += 1;
          break;
        case "cancelled":
          stats.cancelled += 1;
          break;
      }
    }
    return stats;
  }, [jobs, assets]);
}
