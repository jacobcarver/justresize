import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TokenPage } from "@/components/token/TokenPage";
import { SITE, TOKEN_CONFIG, type TokenConfig } from "@/lib/config/site";
import { DEV_PREVIEW_TOKEN, getToken, isSolanaAddress, pumpFunUrl, resolveToken, shortAddress } from "@/lib/token";
import { activityFromCandles, DEV_EXAMPLE_MINT, getTokenActivity } from "@/lib/token-activity";
import { changeInWords, chartGeometry, formatChange, formatUsd, formatUsdCompact } from "@/lib/token-chart";

// Shaped like real addresses (base58, 44 characters) and obviously not real ones.
const MINT = "TestMintForUnitTestsxxxxxxxxxxxxxxxxxxxxxxxx";

const PRELAUNCH: TokenConfig = {
  enabled: true,
  status: "prelaunch",
  name: "",
  ticker: "",
  network: "Solana",
  mintAddress: "",
  explorerUrl: "",
  launchPlatform: { name: "", url: "" },
  telegramUrl: "",
  discordUrl: "",
  description: "",
  statusNote: "",
};

const LIVE: TokenConfig = { ...PRELAUNCH, status: "live", name: "Example", ticker: "$EXMPL", mintAddress: MINT };

// Rows as GeckoTerminal sends them: [seconds, open, high, low, close, volume], newest first.
const HOUR = 3600;
const NOW = 1_800_000_000;
const CANDLES = [
  [NOW, 0.028, 0.032, 0.027, 0.03, 500],
  [NOW - HOUR, 0.025, 0.029, 0.024, 0.028, 300],
  [NOW - 2 * HOUR, 0.02, 0.026, 0.015, 0.025, 200],
];
// Whose activity it is, as getTokenActivity describes a live token with no launch-platform page.
const SOURCE = { mint: MINT, platformUrl: null, platform: null, example: false };
const ACTIVITY = activityFromCandles(CANDLES, "https://www.geckoterminal.com/solana/pools/example", SOURCE)!;

const render = (config: TokenConfig) => renderToStaticMarkup(<TokenPage token={resolveToken(config)} />);

afterEach(() => vi.unstubAllEnvs());

describe("isSolanaAddress", () => {
  it("accepts base58 strings of the right length", () => {
    expect(isSolanaAddress(MINT)).toBe(true);
    expect(isSolanaAddress("So11111111111111111111111111111111111111112")).toBe(true);
  });

  it("rejects everything else", () => {
    for (const value of ["", "undefined", "TBD", "0x52908400098527886E0F7030069857D2E4169EE7", MINT.slice(0, 20), `${MINT}xx`, MINT.replace("T", "0"), MINT.replace("T", "l"), ` ${MINT}`]) {
      expect(isSolanaAddress(value), value).toBe(false);
    }
  });
});

describe("resolveToken", () => {
  it("publishes nothing before launch, even if an address has been filled in early", () => {
    const token = resolveToken({ ...PRELAUNCH, mintAddress: MINT });
    expect(token).toMatchObject({ status: "prelaunch", live: false, statusLabel: "Coming soon", mint: null, mintUrl: null, name: null, ticker: null });
  });

  it("treats a live token without a real mint as not launched", () => {
    for (const mintAddress of ["", "TBD", "undefined", "0x1234"]) {
      const token = resolveToken({ ...LIVE, mintAddress });
      expect(token).toMatchObject({ status: "prelaunch", live: false, mint: null, mintUrl: null });
    }
  });

  it("links a live token's mint to the explorer", () => {
    const token = resolveToken(LIVE);
    expect(token).toMatchObject({
      status: "live",
      live: true,
      statusLabel: "Live on Solana",
      ticker: "$EXMPL",
      mint: MINT,
      mintUrl: `https://solscan.io/token/${MINT}`,
    });
  });

  it("drops channel links that are not https", () => {
    const token = resolveToken({ ...LIVE, telegramUrl: "https://t.me/example", discordUrl: "javascript:alert(1)" });
    expect(token.channels).toEqual([{ label: "Telegram", url: "https://t.me/example" }]);
    expect(resolveToken(LIVE).channels).toEqual([]);
  });

  it("names the launch platform before launch but only links to it once the token is live", () => {
    const platform = { name: "pump.fun", url: "https://pump.fun/coin/example" };
    expect(resolveToken({ ...PRELAUNCH, launchPlatform: platform })).toMatchObject({ launchPlatform: "pump.fun", launchPlatformUrl: null });
    expect(resolveToken({ ...LIVE, launchPlatform: platform })).toMatchObject({ launchPlatform: "pump.fun", launchPlatformUrl: platform.url });
    // pump.fun's page for a coin follows from its mint, so it needs no configured link, and a bad one is ignored in its favour.
    const derived = `https://pump.fun/coin/${MINT}`;
    expect(pumpFunUrl(MINT)).toBe(derived);
    expect(resolveToken({ ...LIVE, launchPlatform: { name: "pump.fun", url: "" } }).launchPlatformUrl).toBe(derived);
    expect(resolveToken({ ...LIVE, launchPlatform: { name: "pump.fun", url: "javascript:alert(1)" } }).launchPlatformUrl).toBe(derived);
    expect(resolveToken({ ...PRELAUNCH, mintAddress: MINT, launchPlatform: { name: "pump.fun", url: "" } }).launchPlatformUrl).toBeNull();
    // Any other platform is only linked when its page is configured.
    expect(resolveToken({ ...LIVE, launchPlatform: { name: "Elsewhere", url: "" } }).launchPlatformUrl).toBeNull();
    expect(resolveToken({ ...LIVE, launchPlatform: { name: "Elsewhere", url: "javascript:alert(1)" } }).launchPlatformUrl).toBeNull();
    expect(resolveToken({ ...LIVE, launchPlatform: { name: "", url: platform.url } })).toMatchObject({ launchPlatform: null, launchPlatformUrl: null });
  });
});

describe("the committed configuration", () => {
  it("is coherent: a published token has a real mint, a name and a ticker", () => {
    if (TOKEN_CONFIG.status === "prelaunch") return;
    expect(isSolanaAddress(TOKEN_CONFIG.mintAddress)).toBe(true);
    expect(TOKEN_CONFIG.name.trim()).not.toBe("");
    expect(TOKEN_CONFIG.ticker.trim()).not.toBe("");
  });

  it("never contains the development preview values", () => {
    const committed = JSON.stringify(TOKEN_CONFIG);
    expect(committed).not.toContain(DEV_PREVIEW_TOKEN.mintAddress);
    // The example coin charted in development is someone else's. It must never be published as this project's mint.
    expect(committed).not.toContain(DEV_EXAMPLE_MINT);
  });

  it("is what a production build shows, whatever the preview variable says", () => {
    vi.stubEnv("NEXT_PUBLIC_TOKEN_PREVIEW", "live");
    vi.stubEnv("NODE_ENV", "production");
    expect(getToken()).toEqual(resolveToken(TOKEN_CONFIG));
  });

  it("can be previewed live in development with values that are plainly not real", () => {
    vi.stubEnv("NEXT_PUBLIC_TOKEN_PREVIEW", "live");
    vi.stubEnv("NODE_ENV", "development");
    const token = getToken();
    expect(token.live).toBe(true);
    // A ticker that has been decided is shown in the preview as itself; only what is missing is invented.
    expect(token.ticker).toBe(`$${TOKEN_CONFIG.ticker || DEV_PREVIEW_TOKEN.ticker}`);
    expect(token.mint).toBe(DEV_PREVIEW_TOKEN.mintAddress);
    expect(token.mint).toMatch(/^DevTest/);
  });
});

describe("the token page", () => {
  it("before launch lists only what exists: no name, ticker or address rows", () => {
    const html = render(PRELAUNCH);
    expect(html).toContain("Coming soon");
    expect([...html.matchAll(/<dt[^>]*>([^<]+)<\/dt>/g)].map((match) => match[1])).toEqual(["Status", "Network", "Official website", ...(SITE.links.x ? ["Official X"] : [])]);
    expect(html).toContain("no token is the JustResize token");
    expect(html).not.toContain("solscan.io");
    expect(html).not.toContain("token-address");
    expect(html).not.toMatch(/undefined|NaN|\[object/);
  });

  it("when live leads with the whole token address and a button that copies it", () => {
    const html = render(LIVE);
    expect(html).toContain("Live on Solana");
    expect(html).toContain(`data-address="${MINT}"`);
    expect(html).toContain('aria-label="Copy token address"');
    expect(html).toContain("Copy address");
    // The address is given once, at the top: there is no row for it lower down, and no explorer button.
    expect(html.split(`data-address="${MINT}"`)).toHaveLength(2);
    expect(html).not.toContain("Mint address");
    expect(html).not.toContain("solscan.io");
    expect(html).not.toContain("Verify the mint");
    expect(html).toContain("Always check the token address against the one at the top of this page");
    expect(html).toContain("$EXMPL");
    expect(html).not.toMatch(/undefined|NaN|\[object/);
  });

  it("shows the launch platform as a name before launch and as a link after", () => {
    const launchPlatform = { name: "pump.fun", url: "https://pump.fun/coin/example" };
    const before = render({ ...PRELAUNCH, launchPlatform });
    expect(before).toContain("Launch platform");
    expect(before).toContain("pump.fun");
    expect(before).not.toContain("https://pump.fun");
    expect(render({ ...LIVE, launchPlatform })).toContain(`href="${launchPlatform.url}"`);
    expect(render(PRELAUNCH)).not.toContain("Launch platform");
  });

  it("never offers a purchase or a wallet connection, and promises nothing about the price", () => {
    for (const html of [render(PRELAUNCH), render(LIVE), renderToStaticMarkup(<TokenPage token={resolveToken(LIVE)} activity={ACTIVITY} />)]) {
      const text = html.replace(/<[^>]+>/g, " ").toLowerCase();
      for (const banned of ["buy", "connect wallet", "swap", "100x", "moon", "guaranteed", "passive income", "market cap", "holders", "goes up", "per year"]) {
        expect(text, banned).not.toContain(banned);
      }
    }
  });

  it("says what happens to the money the site makes, and that the tool never needs the token", () => {
    for (const html of [render(PRELAUNCH), render(LIVE)]) {
      expect(html).toContain("Any money the site makes, from advertising or anything else, will be put into the token.");
      expect(html).toContain("resizing works without a wallet, a token or an account");
    }
  });

  it("shows activity only when there is some, as figures and a described chart", () => {
    expect(render(LIVE)).not.toContain("token-activity");
    const html = renderToStaticMarkup(<TokenPage token={resolveToken(LIVE)} activity={ACTIVITY} />);
    expect(html).toContain('data-testid="token-activity"');
    expect(html).toContain("$0.03");
    expect(html).toContain("+50.0%");
    expect(html).toContain("Price over the last 24 hours: up 50.0%, now $0.03, between $0.015 and $0.032.");
    expect(html).toContain("GeckoTerminal");
    expect(html).not.toContain("Example data");
    expect(html).not.toMatch(/undefined|NaN|\[object/);
  });
});

describe("shortAddress", () => {
  it("keeps both ends", () => {
    expect(shortAddress(MINT, 6)).toBe("TestMi…xxxxxx");
    expect(shortAddress("short")).toBe("short");
  });
});

describe("token activity", () => {
  it("is never fetched for a token that is not live", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    expect(await getTokenActivity(resolveToken(PRELAUNCH))).toBeNull();
    expect(await getTokenActivity(resolveToken({ ...LIVE, enabled: false }))).toBeNull();
    expect(await getTokenActivity(resolveToken({ ...LIVE, mintAddress: "TBD" }))).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("in development charts the example coin, says so, and never does in a production build", async () => {
    const pool = "TestPoo1ForUnitTestsxxxxxxxxxxxxxxxxxxxxxxxx";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const body = String(input).includes("/ohlcv/") ? { data: { attributes: { ohlcv_list: CANDLES } } } : { data: [{ attributes: { address: pool } }] };
      return new Response(JSON.stringify(body), { status: 200 });
    });

    vi.stubEnv("NODE_ENV", "development");
    const example = await getTokenActivity(resolveToken(PRELAUNCH));
    expect(example).toMatchObject({ example: true, mint: DEV_EXAMPLE_MINT, platform: "pump.fun", platformUrl: pumpFunUrl(DEV_EXAMPLE_MINT) });
    expect(String(fetchSpy.mock.calls[0][0])).toContain(`/tokens/${DEV_EXAMPLE_MINT}/pools`);
    expect(renderToStaticMarkup(<TokenPage token={resolveToken(PRELAUNCH)} activity={example} />)).toContain("Example data from another coin, shown in development only.");
    // A real live token is charted as itself, even in development, and its chart leads to its own page.
    expect(await getTokenActivity(resolveToken({ ...LIVE, launchPlatform: { name: "pump.fun", url: "" } }))).toMatchObject({
      example: false,
      mint: MINT,
      platformUrl: pumpFunUrl(MINT),
    });
    // The token switched off is switched off everywhere.
    expect(await getTokenActivity(resolveToken({ ...PRELAUNCH, enabled: false }))).toBeNull();

    fetchSpy.mockClear();
    vi.stubEnv("NODE_ENV", "production");
    expect(await getTokenActivity(resolveToken(PRELAUNCH))).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect((await getTokenActivity(resolveToken(LIVE)))?.example).toBe(false);
    fetchSpy.mockRestore();
  });

  it("is simply absent when the data source fails", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    expect(await getTokenActivity(resolveToken(LIVE))).toBeNull();
    fetchSpy.mockResolvedValue(new Response("{}", { status: 429 }));
    expect(await getTokenActivity(resolveToken(LIVE))).toBeNull();
    fetchSpy.mockRestore();
  });

  it("reads the live mint's most liquid pool, and nothing else", async () => {
    const pool = "TestPoo1ForUnitTestsxxxxxxxxxxxxxxxxxxxxxxxx";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      const body = url.includes("/ohlcv/") ? { data: { attributes: { ohlcv_list: CANDLES } } } : { data: [{ attributes: { address: pool } }] };
      return new Response(JSON.stringify(body), { status: 200 });
    });
    const activity = await getTokenActivity(resolveToken(LIVE));
    const urls = fetchSpy.mock.calls.map((call) => String(call[0]));
    expect(urls).toHaveLength(2);
    expect(urls[0]).toContain(`/tokens/${MINT}/pools`);
    expect(urls[1]).toContain(`/pools/${pool}/ohlcv/`);
    expect(urls[1]).toContain(`token=${MINT}`);
    for (const url of urls) expect(url).toMatch(/^https:\/\/api\.geckoterminal\.com\//);
    expect(activity).toMatchObject({ price: 0.03, sourceUrl: `https://www.geckoterminal.com/solana/pools/${pool}` });
    fetchSpy.mockRestore();
  });

  it("turns candles into a window: oldest first, change from the first open to the last close", () => {
    expect(ACTIVITY.points.map((point) => point.price)).toEqual([0.025, 0.028, 0.03]);
    expect(ACTIVITY.points[0].at).toBe((NOW - 2 * HOUR) * 1000);
    expect(ACTIVITY).toMatchObject({ price: 0.03, high: 0.032, low: 0.015, volume: 1000, latestAt: NOW * 1000 });
    expect(ACTIVITY.changePercent).toBeCloseTo(50, 6);
  });

  it("drops what is malformed or older than a day, and needs two points to draw a line", () => {
    const stale = [NOW - 30 * HOUR, 0.01, 0.01, 0.01, 0.01, 1];
    const withJunk = [...CANDLES, stale, [NOW - HOUR, "0.02", 1, 1, 1, 1], [NOW, 0, 1, 1, 1, 1], null, [NOW]];
    expect(activityFromCandles(withJunk, "", SOURCE)?.points).toHaveLength(3);
    expect(activityFromCandles([CANDLES[0]], "", SOURCE)).toBeNull();
    expect(activityFromCandles([CANDLES[0], stale], "", SOURCE)).toBeNull();
    for (const junk of [null, undefined, {}, "", []]) expect(activityFromCandles(junk, "", SOURCE)).toBeNull();
  });

  it("lays the line out inside its box, by time", () => {
    const { line, area, positions } = chartGeometry(ACTIVITY.points, 100, 40, 4);
    expect(positions).toEqual([
      { x: 0, y: 36 },
      { x: 50, y: 16.8 },
      { x: 100, y: 4 },
    ]);
    expect(line).toBe("M0 36L50 16.8L100 4");
    expect(area).toBe("M0 36L50 16.8L100 4L100 40L0 40Z");
    // A price that never moved is a level line, not a division by zero.
    const flat = chartGeometry([{ at: 0, price: 2 }, { at: 10, price: 2 }], 100, 40);
    expect(flat.positions.map((position) => position.y)).toEqual([20, 20]);
  });

  it("formats money and change the same way everywhere", () => {
    expect(formatUsd(0.035533)).toBe("$0.03553");
    expect(formatUsd(0.00000412345)).toBe("$0.000004123");
    expect(formatUsd(1.2389)).toBe("$1.24");
    expect(formatUsdCompact(1_967_564)).toBe("$1.97M");
    expect(formatUsdCompact(312)).toBe("$312");
    expect(formatChange(24.97)).toBe("+25.0%");
    expect(formatChange(-3.24)).toBe("−3.2%");
    expect(formatChange(0.01)).toBe("0.0%");
    expect(changeInWords(24.97)).toBe("up 25.0%");
    expect(changeInWords(-3.24)).toBe("down 3.2%");
    expect(changeInWords(0)).toBe("unchanged");
  });
});
