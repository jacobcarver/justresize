/**
 * File ingestion: File objects in, SourceImage assets out.
 *
 * Files are validated by name/type the instant they arrive, then inspected
 * in the engine pool (real decode, dimensions, transparency, thumbnail)
 * with bounded concurrency, so dropping 300 photos never decodes 300
 * full-resolution images at once or blocks the page.
 */
import { batchBucket, track } from "@/lib/analytics";
import { DEBUG } from "@/lib/config/features";
import { LIMITS } from "@/lib/config/limits";
import { splitFilename } from "@/lib/files/naming";
import { hintedFormat, precheckFile } from "@/lib/files/validation";
import { toProcessingError } from "@/lib/image/errors";
import { createId } from "@/lib/utils/id";
import { useAssetStore } from "@/stores/useAssetStore";
import type { SourceImage } from "@/types";
import { evictPreviews } from "./previews";
import { discardJobsForSources } from "./queue";
import { getEnginePool } from "./runtime";

const inspections = new Map<string, AbortController>();
const HEAVY_FILE_BYTES = 20 * 1024 * 1024;

function exists(assetId: string): boolean {
  return useAssetStore.getState().assets.some((asset) => asset.id === assetId);
}

export function addFiles(input: Iterable<File>): void {
  const store = useAssetStore.getState();
  let files = [...input];
  if (files.length === 0) return;

  const room = Math.max(0, LIMITS.maxBatchFiles - store.assets.length);
  if (files.length > room) {
    store.setNotice(
      `Only ${LIMITS.maxBatchFiles.toLocaleString("en-US")} images can be open at once, so ${(files.length - room).toLocaleString("en-US")} were not added.`,
    );
    files = files.slice(0, room);
  } else {
    store.setNotice(null);
  }

  // The same file added twice is kept twice: names are not identities, and
  // two different photos are often both called IMG_0001.jpg.
  const assets = files.map((file): SourceImage => {
    const { baseName, extension } = splitFilename(file.name);
    const rejection = precheckFile(file);
    return {
      id: createId("img"),
      file,
      originalName: file.name,
      baseName,
      extension,
      mimeType: file.type,
      format: hintedFormat(file),
      width: 0,
      height: 0,
      aspectRatio: 1,
      fileSize: file.size,
      previewUrl: "",
      status: rejection ? "error" : "loading",
      error: rejection ? toProcessingError(rejection) : undefined,
    };
  });

  store.addAssets(assets);
  for (const asset of assets) {
    if (asset.status === "loading") void inspect(asset);
  }
  track({ name: "files_added", batchSize: batchBucket(assets.length) });
}

async function inspect(asset: SourceImage): Promise<void> {
  const controller = new AbortController();
  inspections.set(asset.id, controller);
  try {
    const result = await getEnginePool().run(
      { type: "inspect", file: asset.file, thumbnailMaxEdge: LIMITS.thumbnailMaxEdge },
      // Dimensions are unknown until the file is read, so byte size stands in
      // for "this might be huge" when deciding how many to decode at once.
      { priority: "high", signal: controller.signal, weight: asset.fileSize > HEAVY_FILE_BYTES ? 2 : 1 },
    );
    // Removed while it was being read: nothing to update, nothing to leak.
    if (controller.signal.aborted || !exists(asset.id)) return;

    useAssetStore.getState().updateAsset(asset.id, {
      format: result.format,
      width: result.width,
      height: result.height,
      aspectRatio: result.width / result.height,
      orientation: result.orientation,
      hasTransparency: result.hasTransparency,
      previewUrl: URL.createObjectURL(result.thumbnail),
      status: "ready",
    });
  } catch (error) {
    const failure = toProcessingError(error);
    if (failure.category === "cancelled" || !exists(asset.id)) return;
    if (DEBUG) console.warn(`[ingest] rejected (${failure.category})`, failure.detail ?? failure.message);
    useAssetStore.getState().updateAsset(asset.id, { status: "error", error: failure });
  } finally {
    inspections.delete(asset.id);
  }
}

/** Removes images and releases everything held for them: jobs, Blobs, previews, object URLs. */
export function removeAssets(assetIds: string[]): void {
  if (assetIds.length === 0) return;
  const store = useAssetStore.getState();
  const removed = new Set(assetIds);

  for (const asset of store.assets) {
    if (!removed.has(asset.id)) continue;
    inspections.get(asset.id)?.abort();
    if (asset.previewUrl) URL.revokeObjectURL(asset.previewUrl);
  }
  discardJobsForSources(assetIds);
  evictPreviews(assetIds);
  store.removeAssets(assetIds);
}

export function clearAssets(): void {
  removeAssets(useAssetStore.getState().assets.map((asset) => asset.id));
  useAssetStore.getState().setNotice(null);
}
