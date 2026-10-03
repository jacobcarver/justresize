/**
 * Byte formatting and parsing.
 *
 * Convention: BINARY units with the everyday labels — 1 KB = 1024 bytes,
 * 1 MB = 1024 KB. This matches what Windows Explorer and most upload forms
 * ("max 2 MB") mean, and it is the stricter reading: a file we report as
 * under 2 MB is also under 2 MB in decimal units.
 */

export const KB = 1024;
export const MB = 1024 * 1024;
export const GB = 1024 * 1024 * 1024;

export type ByteUnit = "KB" | "MB";

/** Fixed decimals with trailing zeros removed: 1.50 → "1.5", 2.00 → "2", but 500 stays "500". */
function trimNumber(value: number, decimals: number): string {
  const fixed = value.toFixed(decimals);
  return fixed.includes(".") ? fixed.replace(/\.?0+$/, "") : fixed;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < KB) return `${Math.round(bytes)} B`;
  if (bytes < MB) {
    const kb = bytes / KB;
    // 1023.6 KB would round to "1024 KB"; show it as MB instead.
    if (Math.round(kb) < 1024) return `${trimNumber(kb, kb < 10 ? 1 : 0)} KB`;
  }
  if (bytes < GB) {
    const mb = bytes / MB;
    if (Number(mb.toFixed(mb < 10 ? 2 : 1)) < 1024) {
      return `${trimNumber(mb, mb < 10 ? 2 : 1)} MB`;
    }
  }
  return `${trimNumber(bytes / GB, 2)} GB`;
}

export function toBytes(value: number, unit: ByteUnit): number {
  return Math.round(value * (unit === "MB" ? MB : KB));
}

export function fromBytes(bytes: number, unit: ByteUnit): number {
  return bytes / (unit === "MB" ? MB : KB);
}

/** Picks the unit a byte count reads most naturally in. */
export function naturalUnit(bytes: number): ByteUnit {
  return bytes >= MB ? "MB" : "KB";
}

/**
 * Describes a size change honestly: a percentage when the output is smaller,
 * a plain "+N" when it grew (never a negative "saving").
 */
export function formatSizeChange(originalBytes: number, outputBytes: number): string {
  if (originalBytes <= 0) return "";
  if (outputBytes === originalBytes) return "Same size";
  if (outputBytes < originalBytes) {
    const percent = (1 - outputBytes / originalBytes) * 100;
    // Near the top, round down: 99.52% is "99.5%", and nothing is ever "100% smaller".
    if (percent >= 99.5) return `${Math.min(99.9, Math.floor(percent * 10) / 10).toFixed(1)}% smaller`;
    // A saving too small to show as a number is still not "0%".
    if (percent < 0.05) return "Under 0.1% smaller";
    return `${trimNumber(percent, percent < 10 ? 1 : 0)}% smaller`;
  }
  return `+${formatBytes(outputBytes - originalBytes)}`;
}

/** Parses strings like "500kb", "1.5 MB", "2m", "300k". Returns bytes or null. */
export function parseByteString(input: string): number | null {
  const match = /^\s*(\d+(?:\.\d+)?)\s*(kb?|mb?)\s*$/i.exec(input);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return null;
  const unit: ByteUnit = match[2].toLowerCase().startsWith("m") ? "MB" : "KB";
  return toBytes(value, unit);
}
