import type { InputHTMLAttributes, LabelHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { ChevronDownIcon } from "./icons";

/** Shared look of every text field and select: a quiet surface, a strong value. */
export const fieldClass =
  "field h-(--control-h) w-full rounded-control border border-line bg-surface-2 text-(length:--control-text) text-fg transition-colors duration-150 placeholder:text-fg-tertiary hover:border-line-strong aria-invalid:border-danger";

export const labelClass = "text-xs text-fg-secondary";

export function FieldLabel({ className = "", ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={`${labelClass} ${className}`} {...props} />;
}

/** Label on the left, a compact control on the right — for settings that are a single choice. */
export function FieldRow({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,11.5rem)] items-center gap-3">
      <FieldLabel htmlFor={htmlFor}>{label}</FieldLabel>
      {children}
    </div>
  );
}

export function HelpText({ className = "", ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={`text-xs leading-relaxed text-fg-tertiary ${className}`} {...props} />;
}

export function TextInput({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="text" className={`${fieldClass} px-2.5 ${className}`} {...props} />;
}

/** A native select (keyboard, screen reader and mobile behaviour for free) with the app's own closed state. */
export function Select({ className = "", children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={`relative ${className}`}>
      <select className={`${fieldClass} cursor-pointer appearance-none truncate pl-2.5 pr-7`} {...props}>
        {children}
      </select>
      <ChevronDownIcon width={14} height={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-fg-tertiary" />
    </div>
  );
}

export function Checkbox({ label, className = "", ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className={`flex min-h-7 cursor-pointer items-center gap-2 text-ui text-fg touch:min-h-11 touch:text-base ${className}`}>
      <input type="checkbox" className="size-3.5 accent-accent touch:size-5" {...props} />
      {label}
    </label>
  );
}

/** A titled group inside the inspector. Sections are separated by space and a hairline, not boxes. */
export function PanelSection({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="py-4 lg:px-5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-ui font-semibold text-fg">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}
