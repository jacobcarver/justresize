/**
 * Everything about the site that is a fact rather than code: its address,
 * its public links, who runs it, and the project token.
 *
 * Two rules hold everywhere these values are used:
 * - An empty value is never rendered. No dead links, no "undefined", no
 *   placeholder address. A missing link, name or mint simply is not there.
 * - Nothing here is secret. A mint address is public by nature, so it is
 *   committed as a plain value, not an environment variable.
 *
 * This file has no imports on purpose: the brand export script
 * (scripts/brand/export.mjs) loads it directly with Node.
 */

export interface SiteConfig {
  name: string;
  /** Production origin, no trailing slash. Canonicals, the sitemap and share images are built from it. */
  url: string;
  tagline: string;
  description: string;
  links: {
    /** Official X profile, e.g. "https://x.com/justresize". */
    x: string;
    github: string;
  };
  /** Shown on the privacy and terms pages. */
  contactEmail: string;
  legal: {
    /** The person or company that operates the site, as it should appear in the terms. */
    operator: string;
    /** Governing law for the terms, e.g. "England and Wales". */
    jurisdiction: string;
    /** ISO date the privacy policy and terms were last changed. */
    lastUpdated: string;
  };
  /**
   * The one-line dismissible banner above the homepage for the launch
   * period. Its wording follows the token's status; it is never shown when
   * the token is disabled. Switch it off once launch is old news.
   */
  launchBanner: boolean;
  /**
   * Google AdSense publisher ID ("ca-pub-…"). It is public: it appears in the
   * page source and in /ads.txt. Empty = no ad script, no /ads.txt, and the
   * strict Content-Security-Policy (see lib/ads.ts and lib/config/csp.ts).
   */
  adsenseClient: string;
  /** The content of Google Search Console's "HTML tag" verification, if that method is used. Empty = no tag. */
  googleSiteVerification: string;
}

export const SITE: SiteConfig = {
  name: "JustResize",
  url: "https://justresize.com",
  tagline: "Resize images without uploading them.",
  description:
    "Compress, resize, crop and convert images directly in your browser. Batch processing and exact file-size targets, with no uploads and no account.",
  links: {
    x: "https://x.com/justresize",
    github: "",
  },
  contactEmail: "",
  legal: {
    operator: "",
    jurisdiction: "",
    lastUpdated: "2026-10-02",
  },
  launchBanner: true,
  adsenseClient: "ca-pub-5446903240594053",
  googleSiteVerification: "",
};

export type TokenStatus = "prelaunch" | "live" | "paused" | "deprecated";

export interface TokenConfig {
  /** false removes /token, every link to it, its sitemap entry and the homepage section. */
  enabled: boolean;
  /** "prelaunch" until a real mint exists. Going live is: fill in the values below, then change this. */
  status: TokenStatus;
  name: string;
  /** Without the "$"; it is added where the ticker is shown. */
  ticker: string;
  network: "Solana";
  /** The token's mint (contract) address. Leave empty until it exists — never a placeholder. */
  mintAddress: string;
  /** Optional. Overrides the default Solscan link for the mint. */
  explorerUrl: string;
  /**
   * Where the token launches. The name is shown before launch ("Launching
   * on pump.fun"). The link is only rendered once the token is live, so
   * `url` stays empty until the token's own page there exists.
   */
  launchPlatform: { name: string; url: string };
  /** Token-specific channels. Empty ones are not rendered. The project's X account is SITE.links.x; the token has none of its own. */
  telegramUrl: string;
  discordUrl: string;
  /**
   * What the token is, in one or two factual sentences. Shown on /token
   * once written; until then the page only says what the token is not.
   */
  description: string;
  /** Shown when status is "paused" or "deprecated". */
  statusNote: string;
}

export const TOKEN_CONFIG: TokenConfig = {
  enabled: true,
  status: "prelaunch",
  name: "",
  ticker: "SIZE",
  network: "Solana",
  mintAddress: "",
  explorerUrl: "",
  launchPlatform: { name: "pump.fun", url: "" },
  telegramUrl: "",
  discordUrl: "",
  description: "",
  statusNote: "",
};
