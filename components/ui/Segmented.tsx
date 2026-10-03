"use client";

import { labelClass } from "./Field";

interface SegmentedProps<T extends string> {
  name: string;
  legend: string;
  value: T;
  options: { value: T; label: string; hint?: string }[];
  onChange: (value: T) => void;
  hideLegend?: boolean;
  /** "md" matches the other form controls; "sm" is for toolbars. */
  size?: "md" | "sm";
  className?: string;
}

const SIZES = {
  md: "h-(--control-h) text-(length:--control-text)",
  sm: "h-7 text-xs touch:h-9 touch:text-sm",
};

/**
 * A radio group that looks like one control. Real radio inputs, so arrow
 * keys, focus and screen readers all behave the way people expect. Segments
 * share the leftover width, so longer labels get the room they need.
 */
export function Segmented<T extends string>({
  name,
  legend,
  value,
  options,
  onChange,
  hideLegend = false,
  size = "md",
  className = "",
}: SegmentedProps<T>) {
  return (
    <fieldset className={`min-w-0 ${className}`}>
      <legend className={hideLegend ? "sr-only" : `mb-1.5 ${labelClass}`}>{legend}</legend>
      <div className={`flex rounded-control bg-surface-2 p-0.5 ${SIZES[size]}`}>
        {options.map((option) => (
          <label key={option.value} className="relative flex flex-auto cursor-pointer" title={option.hint}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="peer sr-only"
            />
            <span className="flex flex-1 items-center justify-center whitespace-nowrap rounded-[4px] px-2 text-center font-medium text-fg-secondary transition-colors duration-150 hover:text-fg peer-checked:bg-surface-3 peer-checked:text-fg peer-checked:shadow-[inset_0_0_0_1px_var(--border-subtle)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-1 peer-focus-visible:outline-accent-text">
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
