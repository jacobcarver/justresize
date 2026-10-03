"use client";

import { useMemo, useState, type KeyboardEvent, type PointerEvent } from "react";
import { chartGeometry, formatUsd, type ActivityPoint } from "@/lib/token-chart";

/** The drawing's own coordinate box. It is stretched to the element's width, so only its proportions matter. */
const WIDTH = 600;
const HEIGHT = 160;

const timeFormat = new Intl.DateTimeFormat("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit" });

/**
 * The token's last 24 hours, large enough to read a moment off it: point at
 * the line (or focus it and use the arrow keys) and the price at that time
 * is shown. The figures beside it on the page carry the same information as
 * text.
 */
export function ActivityChart({ points, up, summary }: { points: ActivityPoint[]; up: boolean; summary: string }) {
  const { line, area, positions } = useMemo(() => chartGeometry(points, WIDTH, HEIGHT, 8), [points]);
  const [active, setActive] = useState<number | null>(null);

  const nearest = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width) * WIDTH;
    let best = 0;
    for (let index = 1; index < positions.length; index += 1) {
      if (Math.abs(positions[index].x - x) < Math.abs(positions[best].x - x)) best = index;
    }
    setActive(best);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    setActive((current) => Math.min(positions.length - 1, Math.max(0, (current ?? positions.length - 1) + step)));
  };

  const shown = active ?? positions.length - 1;
  const left = `${(positions[shown].x / WIDTH) * 100}%`;
  const top = `${(positions[shown].y / HEIGHT) * 100}%`;
  const readout = active === null ? null : `${timeFormat.format(points[active].at)}, ${formatUsd(points[active].price)}`;

  return (
    <div className={up ? "text-success" : "text-danger"}>
      <div
        role="img"
        aria-label={summary}
        tabIndex={0}
        onPointerMove={nearest}
        onPointerDown={nearest}
        onPointerLeave={() => setActive(null)}
        onBlur={() => setActive(null)}
        onKeyDown={onKeyDown}
        className="relative h-40 touch-pan-y rounded-control"
      >
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" aria-hidden focusable="false" className="chart-wipe absolute inset-0 size-full">
          <path d={area} fill="currentColor" opacity="0.12" />
          <path d={line} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-line-subtle" />
        {active !== null && <span aria-hidden className="absolute inset-y-0 w-px bg-line-strong" style={{ left }} />}
        {/* The marker: the latest price at rest, the pointed-at one otherwise. The ring is the page colour, so it stays distinct where it crosses the line. */}
        <span aria-hidden className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current ring-2 ring-background" style={{ left, top }} />
        {readout && (
          <span
            aria-hidden
            className={`pointer-events-none absolute top-0 whitespace-nowrap rounded-control bg-surface-3 px-2 py-1 text-xs text-fg ${
              positions[shown].x > WIDTH / 2 ? "-translate-x-[calc(100%+0.5rem)]" : "translate-x-2"
            }`}
            style={{ left }}
          >
            <span className="font-mono">{readout}</span>
          </span>
        )}
      </div>
      <p className="mt-2 flex justify-between text-xs text-fg-tertiary">
        <span>24 hours ago</span>
        <span>Now</span>
      </p>
      <span role="status" aria-live="polite" className="sr-only">
        {readout}
      </span>
    </div>
  );
}
