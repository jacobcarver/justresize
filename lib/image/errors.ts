import type { ErrorCategory, ProcessingError } from "@/types";

/**
 * Error carrying a user-facing message and a category. Anything thrown inside
 * the engine is normalised to this before it crosses the worker boundary.
 */
export class ImageError extends Error {
  readonly category: ErrorCategory;
  readonly detail?: string;

  constructor(category: ErrorCategory, message: string, detail?: string) {
    super(message);
    this.name = "ImageError";
    this.category = category;
    this.detail = detail;
  }
}

export function cancelledError(): ImageError {
  return new ImageError("cancelled", "Cancelled.");
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw cancelledError();
}

function looksLikeOutOfMemory(text: string): boolean {
  return /out of memory|allocation failed|array buffer allocation|memory access out of bounds|exceeds the maximum/i.test(
    text,
  );
}

/** Converts anything thrown into a serializable, user-presentable error. */
export function toProcessingError(error: unknown): ProcessingError {
  if (error instanceof ImageError) {
    return { category: error.category, message: error.message, detail: error.detail };
  }
  if (error instanceof DOMException && error.name === "AbortError") {
    return { category: "cancelled", message: "Cancelled." };
  }
  const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  if (error instanceof RangeError || looksLikeOutOfMemory(detail)) {
    return {
      category: "memory_limit",
      message: "This image needs more memory than the browser could provide.",
      detail,
    };
  }
  return { category: "unknown", message: "Something went wrong while processing this image.", detail };
}
