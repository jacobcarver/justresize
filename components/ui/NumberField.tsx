"use client";

import { useState } from "react";
import { fieldClass, labelClass } from "./Field";

interface NumberFieldProps {
  id: string;
  label: string;
  /** The stored value. Undefined means "not set / automatic". */
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  /** Shown as the field's value when nothing is set (e.g. the height that follows from a locked ratio). */
  derived?: number;
  placeholder?: string;
  /** Allow a decimal point. Dimensions are whole pixels; percentages and file sizes are not. */
  decimal?: boolean;
  suffix?: string;
  invalid?: boolean;
  hideLabel?: boolean;
  className?: string;
}

function format(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return "";
  return String(Math.round(value * 100) / 100);
}

/**
 * Numeric text input. A text field with a numeric keyboard hint behaves
 * better than type="number": no accidental scroll-wheel changes, no "e",
 * and the field can be emptied while typing. While focused it shows exactly
 * what was typed; the parsed value is reported on every keystroke.
 */
export function NumberField({
  id,
  label,
  value,
  onChange,
  derived,
  placeholder,
  decimal = false,
  suffix,
  invalid = false,
  hideLabel = false,
  className = "",
}: NumberFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value !== undefined ? format(value) : format(derived));

  const handleChange = (raw: string) => {
    const cleaned = decimal
      ? raw.replace(",", ".").replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1")
      : raw.replace(/\D/g, "");
    const text = cleaned.slice(0, 9);
    setDraft(text);
    if (text === "" || text === ".") {
      onChange(undefined);
      return;
    }
    const parsed = Number(text);
    if (Number.isFinite(parsed)) onChange(parsed);
  };

  return (
    <div className={className}>
      <label htmlFor={id} className={hideLabel ? "sr-only" : `mb-1.5 block ${labelClass}`}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode={decimal ? "decimal" : "numeric"}
          autoComplete="off"
          enterKeyHint="done"
          value={shown}
          placeholder={placeholder}
          aria-invalid={invalid || undefined}
          onFocus={(event) => {
            setDraft(shown);
            event.currentTarget.select();
          }}
          onBlur={() => setDraft(null)}
          onChange={(event) => handleChange(event.target.value)}
          className={`${fieldClass} pl-2.5 font-mono tabular-nums ${suffix ? "pr-8" : "pr-2.5"}`}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-fg-tertiary" aria-hidden>
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}
