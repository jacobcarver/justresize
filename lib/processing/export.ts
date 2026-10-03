/**
 * Getting results out: single downloads and the "download all" ZIP.
 */
import { downloadBlob } from "@/lib/files/download";
import { dedupeFilenames, toFolderName } from "@/lib/files/naming";
import { createZip, type ZipEntry } from "@/lib/files/zip";
import { useAssetStore } from "@/stores/useAssetStore";
import { useProcessingStore } from "@/stores/useProcessingStore";
import type { ProcessingJob } from "@/types";
import { getResultBlob } from "./queue";

export function downloadJob(job: ProcessingJob): boolean {
  if (job.state.status !== "complete") return false;
  const blob = getResultBlob(job.id);
  if (!blob) return false;
  downloadBlob(blob, job.state.result.filename);
  return true;
}

/**
 * Completed results in list order, with archive paths that cannot collide:
 * variants go into folders, and duplicate names get -2, -3… appended.
 */
export function collectZipEntries(): ZipEntry[] {
  const { assets } = useAssetStore.getState();
  const { jobs } = useProcessingStore.getState();

  const results: { path: string; blob: Blob }[] = [];
  for (const asset of assets) {
    for (const job of Object.values(jobs[asset.id] ?? {})) {
      if (job.state.status !== "complete") continue;
      const blob = getResultBlob(job.id);
      if (!blob) continue;
      const folder = job.variantName ? `${toFolderName(job.variantName)}/` : "";
      results.push({ path: `${folder}${job.state.result.filename}`, blob });
    }
  }

  const paths = dedupeFilenames(results.map((result) => result.path));
  return results.map((result, index) => ({ path: paths[index], blob: result.blob }));
}

/** One result downloads directly; several are zipped. Returns how many files were included. */
export async function downloadAll(options: { onProgress?: (done: number, total: number) => void } = {}): Promise<number> {
  const entries = collectZipEntries();
  if (entries.length === 0) return 0;
  if (entries.length === 1) {
    downloadBlob(entries[0].blob, entries[0].path.split("/").pop()!);
    return 1;
  }
  const zip = await createZip(entries, options);
  downloadBlob(zip, `justresize-${entries.length}-images.zip`);
  return entries.length;
}
