/**
 * Saves a Blob through the browser's normal download flow. Originals are
 * never touched: every download is a new file.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Safari starts the download asynchronously; revoking immediately cancels it.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
