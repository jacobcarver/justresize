import type { Size } from "@/types";

/**
 * A width × height measurement. Dimensions are the product's subject, so
 * they are always set the same way: tabular figures, never wrapping.
 */
export function Dim({ size, className = "" }: { size: Size; className?: string }) {
  return (
    <span className={`whitespace-nowrap font-mono tabular-nums ${className}`}>
      {size.width} × {size.height}
    </span>
  );
}
