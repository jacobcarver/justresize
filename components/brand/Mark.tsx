/**
 * The JustResize mark: two opposing corners of a frame, on a cobalt tile.
 * The same geometry as app/icon.svg and brand-assets/justresize-mark.svg —
 * change all three together (see BRAND.md).
 */
export function Mark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden focusable="false" className="shrink-0">
      <rect width="32" height="32" rx="7" fill="var(--accent)" />
      <path
        d="M9 15V9h6M23 17v6h-6"
        fill="none"
        stroke="var(--accent-foreground)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Mark and name together. The name is always written "JustResize". */
export function Wordmark({ size = 20 }: { size?: number }) {
  return (
    <>
      <Mark size={size} />
      <span className="text-[0.9375rem] font-semibold tracking-[-0.01em]">JustResize</span>
    </>
  );
}

/**
 * Four corner brackets framing whatever they are placed in (the parent must
 * be positioned). Used where the app asks for images: the empty workspace
 * and the page-wide drop target.
 */
export function CornerFrame({ className = "" }: { className?: string }) {
  const corner = "absolute size-4 border-line-strong transition-colors duration-150";
  return (
    <span aria-hidden className={`pointer-events-none absolute ${className}`}>
      <span className={`${corner} left-0 top-0 border-l border-t`} />
      <span className={`${corner} right-0 top-0 border-r border-t`} />
      <span className={`${corner} bottom-0 left-0 border-b border-l`} />
      <span className={`${corner} bottom-0 right-0 border-b border-r`} />
    </span>
  );
}
