import type { ButtonHTMLAttributes } from "react";

/**
 * Four deliberate levels:
 * - primary: the one main action on screen (Resize, or Download once results are ready)
 * - secondary: a real action that is not the main one (Add images, Download ZIP)
 * - ghost: utilities and housekeeping (Swap, Reset, Clear results)
 * - danger: destructive confirmation
 */
type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "lg" | "md" | "sm";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-accent-fg hover:bg-accent-hover disabled:bg-surface-2 disabled:text-fg-disabled",
  secondary:
    "border border-line bg-surface-2 text-fg hover:border-line-strong hover:bg-surface-3 disabled:border-line-subtle disabled:bg-transparent disabled:text-fg-disabled",
  ghost: "text-fg-secondary hover:bg-surface-hover hover:text-fg aria-pressed:bg-accent-subtle aria-pressed:text-accent-text disabled:text-fg-disabled disabled:hover:bg-transparent",
  danger: "bg-danger-subtle text-danger hover:bg-danger/20",
};

const SIZES: Record<Size, string> = {
  lg: "h-10 px-4 text-sm touch:h-12 touch:text-base",
  md: "h-(--control-h) px-3 text-(length:--control-text)",
  sm: "h-7 px-2 text-xs touch:h-9 touch:px-2.5 touch:text-sm",
};

/** The button look as a class string, for links that are styled as buttons. */
export function buttonClass(variant: Variant = "secondary", size: Size = "md"): string {
  return `inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-control font-medium transition-colors duration-150 disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]}`;
}

export function Button({ variant = "secondary", size = "md", className = "", type = "button", ...props }: ButtonProps) {
  return <button type={type} className={`${buttonClass(variant, size)} ${className}`} {...props} />;
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Icon-only buttons have no visible text, so the accessible name is required. */
  label: string;
}

export function IconButton({ label, className = "", type = "button", ...props }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className={`inline-flex size-7 shrink-0 items-center justify-center rounded-control text-fg-tertiary transition-colors duration-150 hover:bg-surface-hover hover:text-fg disabled:cursor-not-allowed disabled:text-fg-disabled touch:size-10 ${className}`}
      {...props}
    />
  );
}
