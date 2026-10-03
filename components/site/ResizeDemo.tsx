"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { buttonClass } from "@/components/ui/Button";
import { DimensionLines } from "@/components/ui/DimensionLines";
import { SAMPLE_PHOTOS } from "@/lib/site/samples";
import { formatBytes, formatSizeChange, KB, MB } from "@/lib/utils/bytes";

/**
 * The workspace figure's moving part: its picture is resized between a few
 * output sizes, and every number that describes it (dimension lines, the
 * fields, the result line) follows. Each size shows the next of the four
 * example photographs, as if stepping through the open files. Example
 * figures for 12-megapixel phone photos saved as WebP.
 *
 * It advances by itself, slowly, while it is on screen. Choosing a size
 * stops that for good, and with reduced motion it never starts: the sizes
 * are still there to pick, and they change without animating.
 */

const SOURCE_BYTES = 5.8 * MB;

const OUTPUTS = [
  { width: 1600, height: 1200, bytes: 482 * KB },
  { width: 1920, height: 1080, bytes: 520 * KB },
  { width: 1080, height: 1080, bytes: 293 * KB },
  { width: 1080, height: 1350, bytes: 366 * KB },
];

// One example photograph per output, so the picture and its file name can follow the size.
if (OUTPUTS.length !== SAMPLE_PHOTOS.length) throw new Error("The resize demo needs one sample photo per output size.");

/** The stage is as wide as the widest output and as tall as the tallest, so the frames are to scale with each other. */
const STAGE = { width: 1920, height: 1350 };

const DWELL_MS = 4200;
const TWEEN_MS = 900;

interface Shown {
  width: number;
  height: number;
  bytes: number;
}

interface DemoState {
  index: number;
  /** The numbers as displayed: mid-change they are between two outputs. */
  shown: Shown;
  /** True until the visitor picks a size themselves. */
  auto: boolean;
  advance: () => void;
  select: (index: number) => void;
}

const DemoContext = createContext<DemoState | null>(null);

function useDemo(): DemoState {
  const state = useContext(DemoContext);
  if (!state) throw new Error("Resize demo parts must be inside <ResizeDemo>.");
  return state;
}

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function ResizeDemo({ children }: { children: ReactNode }) {
  const [index, setIndex] = useState(0);
  const [auto, setAuto] = useState(true);
  const [shown, setShown] = useState<Shown>(OUTPUTS[0]);
  const current = useRef<Shown>(OUTPUTS[0]);

  // Count the numbers across in step with the frame's own transition (.demo-frame).
  useEffect(() => {
    const from = current.current;
    const to = OUTPUTS[index];
    if (from.width === to.width && from.height === to.height) return;
    const duration = reducedMotion() ? 0 : TWEEN_MS;
    const started = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const progress = duration === 0 ? 1 : Math.min(1, (now - started) / duration);
      const eased = progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
      const mix = (a: number, b: number) => Math.round(a + (b - a) * eased);
      const next = progress === 1 ? to : { width: mix(from.width, to.width), height: mix(from.height, to.height), bytes: mix(from.bytes, to.bytes) };
      current.current = next;
      setShown(next);
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [index]);

  const advance = useCallback(() => setIndex((value) => (value + 1) % OUTPUTS.length), []);
  const select = useCallback((next: number) => {
    setAuto(false);
    setIndex(next);
  }, []);
  const state = useMemo<DemoState>(() => ({ index, shown, auto, advance, select }), [index, shown, auto, advance, select]);

  return <DemoContext.Provider value={state}>{children}</DemoContext.Provider>;
}

/** The file name of the photograph on show. */
export function DemoName() {
  const { index } = useDemo();
  return <>{SAMPLE_PHOTOS[index].name}</>;
}

/** The photographs, stacked in the frame and cropped to it; the one for the selected output is visible. */
export function DemoPhotos() {
  const { index } = useDemo();
  return (
    <>
      {SAMPLE_PHOTOS.map((photo, position) => (
        // eslint-disable-next-line @next/next/no-img-element -- small local files at their final size; nothing for an image optimizer to do.
        <img
          key={photo.src}
          src={photo.src}
          alt=""
          width={960}
          height={720}
          decoding="async"
          draggable={false}
          fetchPriority={position === 0 ? "high" : "low"}
          className={`demo-photo absolute inset-0 size-full object-cover ${position === index ? "opacity-100" : "opacity-0"}`}
        />
      ))}
    </>
  );
}

/** One number of the current output, or the whole "1600 × 1200". */
export function DemoSize({ part }: { part?: "width" | "height" }) {
  const { shown } = useDemo();
  return <>{part ? shown[part] : `${shown.width} × ${shown.height}`}</>;
}

export function DemoBytes() {
  const { shown } = useDemo();
  return <>{formatBytes(shown.bytes)}</>;
}

/** "92% smaller", for the output that is selected rather than the one being counted towards. */
export function DemoSaving() {
  const { index } = useDemo();
  return <>{formatSizeChange(SOURCE_BYTES, OUTPUTS[index].bytes)}</>;
}

/** The picture itself, at the selected output's size within the stage, with its dimension lines. */
export function DemoFrame({ children }: { children: ReactNode }) {
  const { index, shown, auto, advance } = useDemo();
  const stage = useRef<HTMLDivElement>(null);
  const output = OUTPUTS[index];

  // Advance on a slow timer, but only while the picture can be seen.
  useEffect(() => {
    if (!auto || reducedMotion()) return;
    let onScreen = false;
    const observer = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
    });
    if (stage.current) observer.observe(stage.current);
    const timer = window.setInterval(() => {
      if (onScreen && !document.hidden) advance();
    }, DWELL_MS);
    return () => {
      observer.disconnect();
      window.clearInterval(timer);
    };
  }, [auto, advance]);

  return (
    <div ref={stage} className="relative mx-auto w-full max-w-[27rem]" style={{ aspectRatio: `${STAGE.width} / ${STAGE.height}` }}>
      <div
        className="demo-frame absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ width: `${(output.width / STAGE.width) * 100}%`, height: `${(output.height / STAGE.height) * 100}%` }}
      >
        <DimensionLines size={shown} />
        {children}
      </div>
    </div>
  );
}

/** The output sizes as buttons. These are real controls, so they sit outside the illustration. */
export function DemoSizes({ className = "" }: { className?: string }) {
  const { index, select } = useDemo();
  return (
    <div role="group" aria-label="Example output size" className={`flex flex-wrap items-center gap-1 ${className}`}>
      {OUTPUTS.map((output, position) => (
        <button
          key={`${output.width}x${output.height}`}
          type="button"
          aria-pressed={position === index}
          onClick={() => select(position)}
          className={buttonClass("ghost", "sm")}
        >
          <span className="font-mono">
            {output.width} × {output.height}
          </span>
        </button>
      ))}
    </div>
  );
}
