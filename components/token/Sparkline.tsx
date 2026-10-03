import { chartGeometry, type TokenActivity } from "@/lib/token-chart";

const WIDTH = 96;
const HEIGHT = 32;
/** Room on the right for the end marker and its pulse. */
const MARKER = 5;

/**
 * The token's last 24 hours as one small line: green when the price ended
 * higher than it began, red when lower. It is a picture only. Whatever
 * renders it says the direction and the figure in words beside it, so the
 * colour never carries the meaning alone.
 */
export function Sparkline({ activity, className = "" }: { activity: TokenActivity; className?: string }) {
  const { line, area, positions } = chartGeometry(activity.points, WIDTH - MARKER * 2, HEIGHT, 5);
  const last = positions[positions.length - 1];

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      aria-hidden
      focusable="false"
      className={`chart-wipe ${activity.changePercent >= 0 ? "text-success" : "text-danger"} ${className}`}
    >
      <g transform={`translate(${MARKER} 0)`}>
        <path d={area} fill="currentColor" opacity="0.14" />
        <path d={line} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={last.x} cy={last.y} r="3" fill="currentColor" className="chart-ping" />
        <circle cx={last.x} cy={last.y} r="3" fill="currentColor" />
      </g>
    </svg>
  );
}
