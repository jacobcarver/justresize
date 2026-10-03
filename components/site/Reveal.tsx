"use client";

import { createContext, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { formatBytes, KB } from "@/lib/utils/bytes";

/**
 * Plays a figure once, the first time it is seen.
 *
 * <Reveal> watches its own element and sets `data-inview` on it when enough
 * of it is on screen. The animations themselves are CSS (globals.css):
 * anything inside with the class `reveal` settles in, in the order given by
 * `--i`, and `reveal-size` shrinks to its size. The number that counts beside
 * it is <CountBytes>, which reads the same moment from context.
 *
 * The server renders every part in its finished state, so the page is whole
 * without scripts, for search engines, and under reduced motion.
 */

const InView = createContext(false);

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** How much of the element must be visible before it plays, 0 to 1. */
  amount?: number;
  /** Milliseconds between one `reveal` part and the next. */
  step?: number;
}

export function Reveal({ children, className, amount = 0.3, step }: RevealProps) {
  const element = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = element.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setInView(true);
        observer.disconnect();
      },
      { threshold: amount },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [amount]);

  return (
    <div
      ref={element}
      data-reveal=""
      data-inview={inView ? "" : undefined}
      className={className}
      style={step === undefined ? undefined : ({ "--reveal-step": `${step}ms` } as CSSProperties)}
    >
      <InView.Provider value={inView}>{children}</InView.Provider>
    </div>
  );
}

/**
 * A CSS cubic-bezier(x1, y1, x2, y2) as a function of time, so a number
 * counted in script moves exactly with a bar animated in CSS.
 */
function cubicBezier(x1: number, y1: number, x2: number, y2: number): (time: number) => number {
  const at = (a: number, b: number, t: number) => 3 * a * (1 - t) ** 2 * t + 3 * b * (1 - t) * t ** 2 + t ** 3;
  return (time) => {
    // Find the curve parameter whose x is this moment (bisection: x only ever increases).
    let low = 0;
    let high = 1;
    for (let pass = 0; pass < 24; pass += 1) {
      const middle = (low + high) / 2;
      if (at(x1, x2, middle) < time) low = middle;
      else high = middle;
    }
    return at(y1, y2, (low + high) / 2);
  };
}

/** The same curve, length and delay as `.reveal-size` in globals.css (--ease-glide, 2.8s, 0.3s). Change them together. */
const GLIDE = { ease: cubicBezier(0.45, 0, 0.15, 1), duration: 2800, delay: 300 };

/** The value to show: `to` until the figure is seen, then `from` → `to` along the glide, then `to` for good. */
function useGlide(from: number, to: number): number {
  const inView = useContext(InView);
  const [value, setValue] = useState(to);

  useEffect(() => {
    if (!inView || reducedMotion()) return;
    let frame = 0;
    const started = performance.now() + GLIDE.delay;
    const step = (now: number) => {
      const progress = Math.min(1, Math.max(0, (now - started) / GLIDE.duration));
      setValue(progress === 1 ? to : from + (to - from) * GLIDE.ease(progress));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [inView, from, to]);

  return value;
}

/** Mid-count sizes keep one shape ("5.3 MB", "2.1 MB", "940 KB") so the figure does not jump about as it changes. */
function formatCounting(kilobytes: number): string {
  return kilobytes >= 1000 ? `${(kilobytes / 1024).toFixed(1)} MB` : `${Math.round(kilobytes)} KB`;
}

/**
 * A file size that counts down to its value, in kilobytes, in step with the
 * bar beside it: "5.3 MB" … "487 KB". Assistive tech is only ever given the
 * final value.
 */
export function CountBytes({ from, to }: { from: number; to: number }) {
  const value = useGlide(from, to);
  return (
    <>
      <span className="sr-only">{formatBytes(to * KB)}</span>
      <span aria-hidden>{value === to ? formatBytes(to * KB) : formatCounting(value)}</span>
    </>
  );
}
