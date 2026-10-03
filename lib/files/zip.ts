/**
 * Client-side ZIP creation behind a small interface, so the library can be
 * swapped without touching callers.
 *
 * Uses fflate's streaming writer in store mode (no compression): JPEG, PNG
 * and WebP are already compressed, so deflating them again burns CPU for
 * ~0% gain. Files are read and appended one at a time, which keeps peak
 * memory at roughly one copy of the archive instead of two or three.
 */
import { Zip, ZipPassThrough } from "fflate";

export interface ZipEntry {
  /** Path inside the archive, e.g. "photo.webp" or "thumbnail/photo.webp". */
  path: string;
  blob: Blob;
}

export interface ZipOptions {
  signal?: AbortSignal;
  onProgress?: (done: number, total: number) => void;
}

export async function createZip(entries: ZipEntry[], options: ZipOptions = {}): Promise<Blob> {
  const chunks: BlobPart[] = [];
  let failure: Error | null = null;

  const zip = new Zip((error, chunk) => {
    if (error) failure = error;
    else chunks.push(chunk as BlobPart);
  });

  for (let i = 0; i < entries.length; i++) {
    if (options.signal?.aborted) {
      zip.terminate();
      throw new DOMException("ZIP creation cancelled", "AbortError");
    }
    const entry = entries[i];
    const file = new ZipPassThrough(entry.path);
    zip.add(file);
    file.push(new Uint8Array(await entry.blob.arrayBuffer()), true);
    if (failure) throw failure;
    options.onProgress?.(i + 1, entries.length);
  }

  zip.end();
  if (failure) throw failure;
  return new Blob(chunks, { type: "application/zip" });
}
