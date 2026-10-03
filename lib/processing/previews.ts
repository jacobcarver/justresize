/**
 * Preview bitmaps for the interactive preview panel. A preview is a modest
 * (~1600 px) upright copy of the source; full-resolution pixels are only
 * ever decoded during export. A tiny LRU keeps switching between a few
 * images instant without holding a bitmap for every image in a big batch.
 */
import { LIMITS } from "@/lib/config/limits";
import type { SourceImage } from "@/types";
import type { PreviewResult } from "./protocol";
import { getEnginePool } from "./runtime";

interface Entry {
  promise: Promise<PreviewResult>;
  controller: AbortController;
}

const MAX_ENTRIES = 3;
const cache = new Map<string, Entry>();

function release(entry: Entry): void {
  entry.controller.abort();
  entry.promise
    .then((preview) => {
      if ("close" in preview.image) preview.image.close();
      else preview.image.width = preview.image.height = 0;
    })
    .catch(() => {});
}

export function getPreview(asset: SourceImage): Promise<PreviewResult> {
  const cached = cache.get(asset.id);
  if (cached) {
    // Refresh recency.
    cache.delete(asset.id);
    cache.set(asset.id, cached);
    return cached.promise;
  }

  const controller = new AbortController();
  const promise = getEnginePool().run(
    {
      type: "preview",
      file: asset.file,
      maxEdge: LIMITS.previewMaxEdge,
      source: { format: asset.format, hasTransparency: asset.hasTransparency, orientation: asset.orientation },
    },
    { priority: "high", signal: controller.signal },
  );
  const entry: Entry = { promise, controller };
  cache.set(asset.id, entry);
  promise.catch(() => {
    if (cache.get(asset.id) === entry) cache.delete(asset.id);
  });

  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value as string;
    const evicted = cache.get(oldest)!;
    cache.delete(oldest);
    release(evicted);
  }
  return promise;
}

export function evictPreviews(assetIds: string[]): void {
  for (const id of assetIds) {
    const entry = cache.get(id);
    if (!entry) continue;
    cache.delete(id);
    release(entry);
  }
}
