import type { ReactNode } from "react";

interface TooltipProps {
  label: ReactNode;
  children: ReactNode;
  side?: "top" | "bottom";
  /** Which edge of the trigger the bubble lines up with; pick the one that keeps it on screen. */
  align?: "start" | "center" | "end";
  /** Allow the text to wrap, for a sentence rather than a word or two. */
  wrap?: boolean;
  /**
   * "keyboard" (default) shows on hover and keyboard focus. "any" also shows
   * after a tap or click, for content a touch user has no other way to reach.
   */
  focus?: "keyboard" | "any";
  className?: string;
}

const SIDES = { top: "bottom-full mb-1.5", bottom: "top-full mt-1.5" };
const ALIGNS = { start: "left-0", center: "left-1/2 -translate-x-1/2", end: "right-0" };

/**
 * A hover/focus hint, CSS only. The bubble is hidden from assistive tech:
 * the trigger must carry its own accessible name or description, so a
 * tooltip never hides information that is not available some other way.
 */
export function Tooltip({ label, children, side = "top", align = "center", wrap = false, focus = "keyboard", className = "" }: TooltipProps) {
  return (
    <span className={`group/tip relative inline-flex ${className}`}>
      {children}
      <span
        aria-hidden
        className={`pointer-events-none absolute z-50 rounded-control border border-line bg-surface-3 px-2 py-1 text-xs font-normal text-fg opacity-0 transition-opacity duration-150 group-hover/tip:opacity-100 group-hover/tip:delay-300 ${
          focus === "any" ? "group-focus-within/tip:opacity-100" : "group-has-focus-visible/tip:opacity-100"
        } ${wrap ? "w-60 whitespace-normal leading-relaxed" : "whitespace-nowrap"} ${SIDES[side]} ${ALIGNS[align]}`}
      >
        {label}
      </span>
    </span>
  );
}
