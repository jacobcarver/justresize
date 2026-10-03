/**
 * Turns the raw token config into what the site is allowed to show.
 *
 * Every page reads the token through `getToken()`, never the config
 * directly, so the safety rules live in one place: an address is only
 * shown if it has the shape of a real Solana address, a token is only
 * "live" if it has a mint, and anything missing comes back as null rather
 * than as an empty string a template could print by accident.
 */
import { TOKEN_CONFIG, type TokenConfig, type TokenStatus } from "@/lib/config/site";

const EXPLORER = "https://solscan.io";

/** A coin's own page on pump.fun is always at this address, so it never has to be typed into the config. */
export function pumpFunUrl(mint: string): string {
  return `https://pump.fun/coin/${mint}`;
}

/** Solana addresses are base58 (no 0, O, I or l), 32 to 44 characters. */
export function isSolanaAddress(value: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
}

/** Only https links are ever rendered. */
function httpsUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function text(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export interface TokenView {
  enabled: boolean;
  status: TokenStatus;
  /** Live, with a published mint. */
  live: boolean;
  statusLabel: string;
  name: string | null;
  /** With its "$", e.g. "$RESIZE". */
  ticker: string | null;
  network: string;
  mint: string | null;
  mintUrl: string | null;
  /** Name of the launch platform, e.g. "pump.fun". */
  launchPlatform: string | null;
  /** The token's page on the launch platform. Null until the token is live. For pump.fun it is derived from the mint when none is configured. */
  launchPlatformUrl: string | null;
  channels: { label: string; url: string }[];
  description: string | null;
  statusNote: string | null;
}

const STATUS_LABELS: Record<TokenStatus, string> = {
  prelaunch: "Coming soon",
  live: "Live on Solana",
  paused: "Paused",
  deprecated: "Deprecated",
};

export function resolveToken(config: TokenConfig): TokenView {
  const mintValid = isSolanaAddress(config.mintAddress);
  // A "live" token without a real mint is a configuration mistake. Showing
  // the pre-launch page is the safe way to be wrong.
  const status: TokenStatus = config.status !== "prelaunch" && !mintValid ? "prelaunch" : config.status;
  const published = status !== "prelaunch";

  const mint = published ? config.mintAddress : null;
  const ticker = text(config.ticker.replace(/^\$+/, ""));
  const launchPlatform = text(config.launchPlatform.name);

  const channels = [
    { label: "Telegram", url: httpsUrl(config.telegramUrl) },
    { label: "Discord", url: httpsUrl(config.discordUrl) },
  ].filter((channel): channel is { label: string; url: string } => channel.url !== null);

  return {
    enabled: config.enabled,
    status,
    live: status === "live",
    statusLabel: STATUS_LABELS[status],
    name: text(config.name),
    ticker: ticker ? `$${ticker}` : null,
    network: config.network,
    mint,
    mintUrl: mint ? (httpsUrl(config.explorerUrl) ?? `${EXPLORER}/token/${mint}`) : null,
    launchPlatform,
    // A link to a trading venue before the mint is published could only point at someone else's token.
    // Once live: the configured page, or for pump.fun the coin's page, which follows from the mint.
    launchPlatformUrl:
      launchPlatform && status === "live" && mint
        ? (httpsUrl(config.launchPlatform.url) ?? (launchPlatform.toLowerCase() === "pump.fun" ? pumpFunUrl(mint) : null))
        : null,
    channels,
    description: text(config.description),
    statusNote: text(config.statusNote),
  };
}

/**
 * Development only: `NEXT_PUBLIC_TOKEN_PREVIEW=live npm run dev` shows the
 * live page with values nobody could mistake for real ones. A production
 * build ignores the variable, so these can never ship.
 */
export const DEV_PREVIEW_TOKEN: Partial<TokenConfig> = {
  status: "live",
  name: "Dev Preview Token",
  ticker: "DEVTEST",
  mintAddress: "DevTestMintNotRea1DoNotUse111111111111111111",
  launchPlatform: { name: "pump.fun", url: "https://pump.fun/" },
  description: "Development preview. None of the values on this page are real.",
};

/** True only under `next dev` (or a test) with the preview variable set. Never in a production build. */
export function isTokenPreview(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_TOKEN_PREVIEW === "live";
}

export function getToken(): TokenView {
  if (!isTokenPreview()) return resolveToken(TOKEN_CONFIG);
  // The preview invents what is missing, and keeps a name or ticker that has already been decided, so they can be seen in place.
  return resolveToken({
    ...TOKEN_CONFIG,
    ...DEV_PREVIEW_TOKEN,
    name: TOKEN_CONFIG.name || DEV_PREVIEW_TOKEN.name || "",
    ticker: TOKEN_CONFIG.ticker || DEV_PREVIEW_TOKEN.ticker || "",
  });
}

/** "9xQe…k3Pd" — for places too narrow for a whole address. The full value is always what gets copied. */
export function shortAddress(address: string, edge = 6): string {
  return address.length <= edge * 2 + 1 ? address : `${address.slice(0, edge)}…${address.slice(-edge)}`;
}
