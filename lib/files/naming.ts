import { OUTPUT_FORMATS } from "@/lib/image/formats";
import type { NamingOptions, OutputFormat } from "@/types";

export const DEFAULT_NAMING: NamingOptions = {
  pattern: "{name}",
  lowercase: false,
  replaceSpaces: false,
  separator: "-",
};

/** Ready-made patterns so nobody has to learn the token syntax for common cases. */
export const NAMING_PRESETS: { id: string; label: string; pattern: string }[] = [
  { id: "original", label: "Original name", pattern: "{name}" },
  { id: "dimensions", label: "Name + dimensions", pattern: "{name}-{width}x{height}" },
  { id: "numbered", label: "Name + number", pattern: "{name}-{index}" },
];

export interface NamingContext {
  /** Original filename without extension. */
  name: string;
  width: number;
  height: number;
  format: OutputFormat;
  /** 1-based position within the batch. */
  index: number;
  /** Batch size; determines zero-padding of {index}. */
  total: number;
}

export function splitFilename(filename: string): { baseName: string; extension: string } {
  const dot = filename.lastIndexOf(".");
  // A leading dot is a hidden file, not an extension.
  if (dot <= 0) return { baseName: filename, extension: "" };
  return { baseName: filename.slice(0, dot), extension: filename.slice(dot + 1).toLowerCase() };
}

/** Index padding: at least two digits, more when the batch needs it (001…150). */
export function padIndex(index: number, total: number): string {
  const digits = Math.max(2, String(Math.max(1, total)).length);
  return String(index).padStart(digits, "0");
}

/** Removes characters that are illegal or dangerous in filenames on any major OS. */
export function sanitizeFilenamePart(value: string): string {
  return (
    value
      // Path separators, reserved characters and control codes.
      .replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, "")
      .replace(/\s+/g, " ")
      // Leading dots would create hidden files or, inside a ZIP, "../" style paths.
      .replace(/^[.\s]+/, "")
      .replace(/[.\s]+$/, "")
  );
}

/** Builds an output filename (with extension) from a naming pattern. */
export function formatFilename(options: NamingOptions, context: NamingContext): string {
  const info = OUTPUT_FORMATS[context.format];
  const pattern = options.pattern.trim() || DEFAULT_NAMING.pattern;

  const tokens: Record<string, string> = {
    name: context.name,
    width: String(context.width),
    height: String(context.height),
    format: info.id,
    index: padIndex(context.index, context.total),
  };

  let base = pattern.replace(/\{(\w+)\}/g, (match, token: string) => tokens[token.toLowerCase()] ?? match);
  base = sanitizeFilenamePart(base);
  if (options.replaceSpaces) base = base.replace(/ /g, options.separator ?? "-");
  if (options.lowercase) base = base.toLowerCase();
  if (!base) base = "image";

  return `${base}.${info.extension}`;
}

/**
 * Makes a list of filenames unique by appending -2, -3… before the extension.
 * Comparison is case-insensitive because most filesystems are.
 */
export function dedupeFilenames(filenames: string[]): string[] {
  const used = new Set<string>();
  return filenames.map((filename) => {
    let candidate = filename;
    if (used.has(candidate.toLowerCase())) {
      const { baseName, extension } = splitFilename(filename);
      const suffix = extension ? `.${extension}` : "";
      let counter = 2;
      do {
        candidate = `${baseName}-${counter}${suffix}`;
        counter += 1;
      } while (used.has(candidate.toLowerCase()));
    }
    used.add(candidate.toLowerCase());
    return candidate;
  });
}

/** Folder-safe version of a variant name for ZIP paths. */
export function toFolderName(name: string): string {
  return sanitizeFilenamePart(name).replace(/ /g, "-").toLowerCase() || "output";
}
