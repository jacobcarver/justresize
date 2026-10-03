import { ArrowRightIcon, CheckIcon } from "@/components/ui/icons";
import type { CSSProperties } from "react";
import { SAMPLE_PHOTOS } from "@/lib/site/samples";
import { Flow } from "./Flow";
import { CountBytes, Reveal } from "./Reveal";

/**
 * The homepage's smaller illustrations. Like the workspace figure they are
 * drawn from the app's own parts and show example numbers, and each is one
 * image to assistive tech, described in a sentence.
 *
 * Each plays once when it scrolls into view (Reveal.tsx): the file-size bar
 * shrinks slowly from the original to the result while its number counts
 * down with it, and the batch rows finish one after another, the way they
 * do in the tool.
 */

/** A part's place in its figure's order (the `reveal` and `hero-in` classes, globals.css). */
export const order = (index: number) => ({ "--i": index }) as CSSProperties;

// 5.3 MB is 5427 KB, so on a line as long as the original the limit sits 9.2% along and the result just short of it.
const ORIGINAL_KB = 5427;
const RESULT_KB = 487;
const LIMIT_AT = (500 / ORIGINAL_KB) * 100;
const RESULT_AT = (RESULT_KB / ORIGINAL_KB) * 100;

/** File sizes to scale on one line: the whole line is the original, the tick is the limit, the bar is the result. */
export function TargetScale({ className = "" }: { className?: string }) {
  return (
    <Reveal className={className} amount={0.6}>
      <div role="img" aria-label="Example: a 5.3 MB image, a 500 KB limit, and a 487 KB result that fits under it.">
        <div aria-hidden>
          <div className="flex items-end justify-between gap-6">
            <div>
              {/* "Fits" is the verdict, so it arrives once the bar has stopped under the limit. */}
              <p className="reveal flex items-center gap-1.5 text-ui text-fg-secondary" style={order(27)}>
                Result
                <CheckIcon width={14} height={14} className="text-success" />
                Fits
              </p>
              <p className="reveal mt-2 text-[length:clamp(2.75rem,8vw,5.5rem)] font-medium leading-[0.9] tracking-[-0.05em] text-accent-text">
                <span className="font-mono">
                  <CountBytes from={ORIGINAL_KB} to={RESULT_KB} />
                </span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-ui text-fg-secondary">Original</p>
              <p className="mt-2 text-[length:clamp(1.25rem,3vw,2rem)] leading-none tracking-[-0.03em] text-fg-secondary">
                <span className="font-mono">5.3 MB</span>
              </p>
            </div>
          </div>
          <div className="relative mt-5 h-3">
            <span className="absolute inset-x-0 top-1/2 h-px bg-line-strong" />
            <span className="absolute inset-y-0 right-0 w-px bg-line-strong" />
            <span className="reveal-size absolute inset-0 bg-accent" style={{ transform: `scaleX(${RESULT_AT / 100})` }} />
            <span className="absolute -bottom-7 -top-1.5 w-px bg-fg" style={{ left: `${LIMIT_AT}%` }} />
          </div>
          <p className="mt-3 pl-2.5 text-ui text-fg-secondary" style={{ marginLeft: `${LIMIT_AT}%` }}>
            Limit <span className="font-mono text-fg">500 KB</span>
          </p>
        </div>
      </div>
    </Reveal>
  );
}

const BATCH_ROWS = [
  { name: SAMPLE_PHOTOS[0].name, from: "4032 × 3024 JPEG 5.8 MB", to: "1600 × 1200 WebP 482 KB", change: "92% smaller" },
  { name: SAMPLE_PHOTOS[1].name, from: "3024 × 4032 JPEG 4.9 MB", to: "1200 × 1600 WebP 341 KB", change: "93% smaller" },
  { name: SAMPLE_PHOTOS[2].name, from: "4032 × 3024 JPEG 5.1 MB", to: "1600 × 1200 WebP 407 KB", change: "92% smaller" },
  { name: SAMPLE_PHOTOS[3].name, from: "4032 × 3024 JPEG 5.3 MB", to: "1600 × 1200 WebP 398 KB", change: "93% smaller" },
];

/** The file queue after a batch: the first rows of an 84-image run, then the run as a flow. */
export function BatchFigure() {
  return (
    <Reveal amount={0.35} step={170}>
      <div role="img" aria-label="Example: 84 images resized to fit 1600 pixels and saved as WebP, 412 MB down to 31 MB, downloaded as one ZIP.">
        <div aria-hidden>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pb-2 text-xs text-fg-secondary">
            <span className="text-ui font-semibold text-fg">
              Files <span className="ml-1 font-mono text-xs font-normal text-fg-tertiary">84</span>
            </span>
            {/* The batch's own summary comes after its rows have finished. */}
            <span className="reveal flex items-center gap-1.5 text-fg" style={order(BATCH_ROWS.length + 1)}>
              <CheckIcon width={14} height={14} className="text-success" />
              84 images ready
            </span>
            <span className="reveal flex items-center gap-1.5 font-mono" style={order(BATCH_ROWS.length + 2)}>
              412 MB
              <ArrowRightIcon width={12} height={12} className="text-fg-tertiary" />
              31 MB
            </span>
            <span className="reveal" style={order(BATCH_ROWS.length + 2)}>
              92% smaller
            </span>
          </div>
          <ul className="border-t border-line-subtle">
            {BATCH_ROWS.map((row, index) => (
              <li
                key={row.name}
                className={`relative grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 border-b border-line-subtle py-2 pl-3 pr-2 sm:grid-cols-[auto_minmax(0,1fr)_auto] ${
                  index === 0 ? "bg-accent-subtle" : ""
                }`}
              >
                {index === 0 && <span className="absolute inset-y-0 left-0 w-0.5 bg-accent-text" />}
                {/* eslint-disable-next-line @next/next/no-img-element -- a 96 px local file at its final size; nothing for an image optimizer to do. */}
                <img
                  src={SAMPLE_PHOTOS[index].thumb}
                  alt=""
                  width={96}
                  height={96}
                  loading="lazy"
                  decoding="async"
                  className="row-span-2 size-10 rounded-[5px] object-cover sm:row-span-1"
                />
                <div className="min-w-0">
                  <p className="truncate text-ui font-medium">{row.name}</p>
                  <p className="truncate font-mono text-xs text-fg-tertiary">{row.from}</p>
                </div>
                {/* Each row's result arrives in turn, as it does when the tool works through a batch. */}
                <div className="reveal col-start-2 min-w-0 text-xs sm:col-start-3 sm:text-right" style={order(index + 1)}>
                  <p className="flex items-center gap-1.5 truncate font-mono text-fg sm:justify-end">
                    <CheckIcon width={14} height={14} className="shrink-0 text-success" />
                    {row.to}
                  </p>
                  <p className="pl-5 text-fg-secondary sm:pl-0">{row.change}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="pt-2.5 text-xs text-fg-tertiary">and 80 more</p>
          <div className="reveal mt-8" style={order(BATCH_ROWS.length + 3)}>
            <Flow
              steps={[
                { head: <span className="font-mono">84</span>, sub: "files" },
                { head: <span className="font-mono">84</span>, sub: "processed" },
                { head: "ZIP", sub: <span className="font-mono">31 MB</span>, tone: "accent" },
              ]}
            />
          </div>
        </div>
      </div>
    </Reveal>
  );
}

/** Where an image goes: file, browser, new file. Nothing else is on the path. */
export function LocalFlowFigure({ className = "" }: { className?: string }) {
  return (
    <div
      role="img"
      aria-label="An image file is read by your browser, resized, compressed or converted there, and saved as a new file. No server is involved."
      className={className}
    >
      <Flow
        direction="row-from-lg"
        live
        steps={[
          { head: "Image", sub: "On your device" },
          { head: "Your browser", sub: "Resize, compress, convert", tone: "accent" },
          { head: "New image", sub: "Saved to your device" },
        ]}
      />
    </div>
  );
}
