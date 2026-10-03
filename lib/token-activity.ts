/**
 * Recent market activity for the published token: the last 24 hours of its
 * price in its most liquid pool, from GeckoTerminal's public API.
 *
 * It is fetched by the server and cached for a few minutes, so a visitor's
 * browser never contacts GeckoTerminal and the page's own security policy
 * does not need to allow it. Nothing here can trade, quote or connect a
 * wallet: it reads public history and draws a line.
 *
 * On the live site there is only ever activity for a token that is live
 * with a published mint. Before launch, or when the data source is
 * unreachable, the answer is null and the pages show nothing in its place.
 *
 * Under `npm run dev` the chart is always there, drawn from an example coin
 * and labelled as an example, so it can be seen and worked on before the
 * real token exists.
 */
import { isTokenPreview, pumpFunUrl, type TokenView } from "@/lib/token";
import type { TokenActivity } from "@/lib/token-chart";

const API = "https://api.geckoterminal.com/api/v2/networks/solana";
const POOL_PAGE = "https://www.geckoterminal.com/solana/pools";

/** How long a fetched result is reused before the next visitor triggers a refresh. */
const REVALIDATE_SECONDS = 300;
const TIMEOUT_MS = 5000;

const CANDLE_MINUTES = 15;
export const ACTIVITY_WINDOW_HOURS = 24;
const WINDOW_MS = ACTIVITY_WINDOW_HOURS * 60 * 60 * 1000;

/**
 * Development only: the coin whose market stands in for the project's own
 * until that exists. It is a real, unrelated token the owner picked as an
 * example. A production build never reads it, because showing someone
 * else's coin as this project's on the live site would send visitors to the
 * wrong token. To change the example, change this address.
 */
export const DEV_EXAMPLE_MINT = "GAwhcphCqCv5bKHmCiN4VDdNWfbXJL4npmkc8L3Q9S9H";

/**
 * Which mint to chart, and whether it is the example: the project's own
 * once it is live; otherwise, in development only, the example.
 */
function activitySource(token: TokenView): ActivitySource | null {
  if (!token.enabled) return null;
  if (token.live && token.mint && !isTokenPreview()) {
    return { mint: token.mint, platformUrl: token.launchPlatformUrl, platform: token.launchPlatform, example: false };
  }
  if (process.env.NODE_ENV !== "development") return null;
  return { mint: DEV_EXAMPLE_MINT, platformUrl: pumpFunUrl(DEV_EXAMPLE_MINT), platform: "pump.fun", example: true };
}

/** Whose activity it is: the mint, where its chart links to, and whether it is only the example. */
export type ActivitySource = Pick<TokenActivity, "mint" | "platformUrl" | "platform" | "example">;

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

/**
 * GeckoTerminal's candles ([seconds, open, high, low, close, volume], newest
 * first) → the window's activity, or null if they do not hold two usable
 * points. Anything malformed is dropped rather than drawn.
 */
export function activityFromCandles(candles: unknown, sourceUrl: string, source: ActivitySource): TokenActivity | null {
  if (!Array.isArray(candles)) return null;

  const rows = candles
    .filter((row): row is number[] => Array.isArray(row) && row.length >= 6 && row.every(finite) && row[1] > 0 && row[4] > 0)
    .sort((a, b) => a[0] - b[0]);
  if (rows.length === 0) return null;

  const latestAt = rows[rows.length - 1][0] * 1000;
  const recent = rows.filter((row) => row[0] * 1000 > latestAt - WINDOW_MS);
  if (recent.length < 2) return null;

  const open = recent[0][1];
  const price = recent[recent.length - 1][4];
  return {
    points: recent.map((row) => ({ at: row[0] * 1000, price: row[4] })),
    price,
    high: Math.max(...recent.map((row) => row[2])),
    low: Math.min(...recent.map((row) => row[3])),
    changePercent: ((price - open) / open) * 100,
    volume: recent.reduce((sum, row) => sum + row[5], 0),
    sourceUrl,
    latestAt,
    ...source,
  };
}

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    next: { revalidate: REVALIDATE_SECONDS },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`GeckoTerminal answered ${response.status}`);
  return response.json();
}

/** The address of the token's most liquid pool: GeckoTerminal lists a token's pools with that one first. */
function topPoolAddress(json: unknown): string | null {
  const pools = (json as { data?: { attributes?: { address?: unknown } }[] } | null)?.data;
  const address = Array.isArray(pools) ? pools[0]?.attributes?.address : null;
  return typeof address === "string" && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address) ? address : null;
}

export async function getTokenActivity(token: TokenView): Promise<TokenActivity | null> {
  const source = activitySource(token);
  if (!source) return null;
  const { mint } = source;

  try {
    const pool = topPoolAddress(await getJson(`${API}/tokens/${mint}/pools?page=1`));
    if (!pool) return null;
    // `token` asks for this token's price, whichever side of the pool it is on.
    const limit = (ACTIVITY_WINDOW_HOURS * 60) / CANDLE_MINUTES;
    const history = await getJson(`${API}/pools/${pool}/ohlcv/minute?aggregate=${CANDLE_MINUTES}&limit=${limit}&currency=usd&token=${mint}`);
    const candles = (history as { data?: { attributes?: { ohlcv_list?: unknown } } } | null)?.data?.attributes?.ohlcv_list;
    return activityFromCandles(candles, `${POOL_PAGE}/${pool}`, source);
  } catch {
    // A page without a chart is fine. A page that fails because a chart's data source is down is not.
    return null;
  }
}
