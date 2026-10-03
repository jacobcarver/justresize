/**
 * The token activity chart's data shape, geometry and number formatting.
 * Pure functions with no fetching and no addresses, so both the server-drawn
 * sparkline and the interactive chart in the browser can use them. Where
 * the data comes from is lib/token-activity.ts.
 */

export interface ActivityPoint {
  /** Epoch milliseconds: the start of the interval this price closed. */
  at: number;
  /** US dollars. */
  price: number;
}

export interface TokenActivity {
  /** Oldest first. At least two. */
  points: ActivityPoint[];
  /** The latest price, in US dollars. */
  price: number;
  high: number;
  low: number;
  /** Change across the window, in percent: from the first interval's opening price to the latest. */
  changePercent: number;
  /** Traded across the window, in US dollars. */
  volume: number;
  /** The pool the figures come from, on GeckoTerminal. */
  sourceUrl: string;
  /** Epoch milliseconds: when the latest interval began. */
  latestAt: number;
  /** The mint these figures are for: what "copy address" copies beside the chart. */
  mint: string;
  /** The coin's page on its launch platform, which the small chart opens. Null when there is none. */
  platformUrl: string | null;
  /** The platform's name, for the link's label, e.g. "pump.fun". */
  platform: string | null;
  /** True when this is the development example coin, not the project's own token. Never true in a production build. */
  example: boolean;
}

export interface ChartGeometry {
  /** The price line, as an SVG path. */
  line: string;
  /** The same line closed down to the bottom edge, for the fill under it. */
  area: string;
  /** Each point's position, in the same order as the activity's points. */
  positions: { x: number; y: number }[];
}

const round = (value: number) => Math.round(value * 100) / 100;

/**
 * Lays the points out in a width × height box. Time runs along x by each
 * point's real timestamp, so a gap in trading shows as a gap in time. The
 * line keeps `inset` clear of the top and bottom edges, which leaves room
 * for the stroke and the end marker.
 */
export function chartGeometry(points: ActivityPoint[], width: number, height: number, inset = 3): ChartGeometry {
  const first = points[0].at;
  const span = Math.max(1, points[points.length - 1].at - first);
  const low = Math.min(...points.map((point) => point.price));
  const range = Math.max(...points.map((point) => point.price)) - low;

  const positions = points.map((point) => ({
    x: round(((point.at - first) / span) * width),
    // A price that never moved is a level line through the middle, not one along the bottom.
    y: round(range === 0 ? height / 2 : height - inset - ((point.price - low) / range) * (height - inset * 2)),
  }));
  const line = positions.map((position, index) => `${index === 0 ? "M" : "L"}${position.x} ${position.y}`).join("");

  return { line, area: `${line}L${width} ${height}L0 ${height}Z`, positions };
}

/** "$0.0356", "$1.24", "$0.00000412": four significant figures below a dollar, cents above. */
export function formatUsd(value: number): string {
  if (!Number.isFinite(value)) return "";
  if (value >= 1) return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
  return `$${new Intl.NumberFormat("en-US", { maximumSignificantDigits: 4, maximumFractionDigits: 12 }).format(value)}`;
}

/** "$1.97M", "$48.2K", "$312". */
export function formatUsdCompact(value: number): string {
  if (!Number.isFinite(value)) return "";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumSignificantDigits: 3 }).format(value);
}

/** "+25.0%", "−3.2%", "0.0%": always signed when it moved, with a real minus sign. */
export function formatChange(percent: number): string {
  const rounded = Math.round(percent * 10) / 10;
  const sign = rounded > 0 ? "+" : rounded < 0 ? "−" : "";
  return `${sign}${Math.abs(rounded).toFixed(1)}%`;
}

/** "up 25.0%" / "down 3.2%" / "unchanged": the direction in words, for wherever the chart's colour cannot be seen. */
export function changeInWords(percent: number): string {
  const change = formatChange(percent);
  if (change.startsWith("+")) return `up ${change.slice(1)}`;
  if (change.startsWith("−")) return `down ${change.slice(1)}`;
  return "unchanged";
}
