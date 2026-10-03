import type { Size } from "@/types";

/**
 * Dimension lines along the top and left edge of whatever they are placed
 * in (the parent must be positioned), the way a drawing is annotated. This
 * is the product's one signature motif: thin, low contrast, and always
 * showing a true measurement.
 */
export function DimensionLines({ size }: { size: Size }) {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-full mb-2 flex items-center font-mono text-2xs text-fg-tertiary"
      >
        <span className="h-2 w-px shrink-0 bg-line-strong" />
        <span className="h-px min-w-0 flex-1 bg-line" />
        <span className="px-1.5">{size.width}</span>
        <span className="h-px min-w-0 flex-1 bg-line" />
        <span className="h-2 w-px shrink-0 bg-line-strong" />
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-full mr-2 flex flex-col items-center font-mono text-2xs text-fg-tertiary"
      >
        <span className="h-px w-2 shrink-0 bg-line-strong" />
        <span className="min-h-0 w-px flex-1 bg-line" />
        <span className="rotate-180 py-1.5 [writing-mode:vertical-rl]">{size.height}</span>
        <span className="min-h-0 w-px flex-1 bg-line" />
        <span className="h-px w-2 shrink-0 bg-line-strong" />
      </div>
    </>
  );
}
