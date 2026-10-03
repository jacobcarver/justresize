import type { CSSProperties, InputHTMLAttributes } from "react";

interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "min" | "max"> {
  value: number;
  min: number;
  max: number;
}

/** A range input whose track is filled up to the thumb (the fill is drawn in globals.css from --fill). */
export function Slider({ value, min, max, className = "", ...props }: SliderProps) {
  const fill = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <input
      type="range"
      min={min}
      max={max}
      value={value}
      className={`w-full ${className}`}
      style={{ "--fill": `${fill}%` } as CSSProperties}
      {...props}
    />
  );
}
