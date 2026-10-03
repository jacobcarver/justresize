/**
 * Whether this build carries Google AdSense, in one place: the root layout
 * (the script tag), next.config.ts (the Content-Security-Policy), /ads.txt
 * and /privacy all ask here, so they cannot disagree.
 *
 * Ads are on in a production build when SITE.adsenseClient is set. They are
 * off in development, on Vercel preview deployments, and when the build is
 * made with NEXT_PUBLIC_ADS=off — which is how the end-to-end suite builds,
 * so its tests never depend on Google's servers.
 *
 * Relative import on purpose: next.config.ts loads this file before the "@/"
 * alias exists.
 */
import { SITE } from "./config/site";

/** The publisher ID as configured, or null. Says nothing about whether this build loads the script. */
export function adsenseClient(): string | null {
  return /^ca-pub-\d{10,20}$/.test(SITE.adsenseClient) ? SITE.adsenseClient : null;
}

/** The publisher ID if this build should load the ad script, otherwise null. */
export function activeAdsenseClient(): string | null {
  if (process.env.NODE_ENV !== "production") return null;
  if (process.env.NEXT_PUBLIC_ADS === "off") return null;
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") return null;
  return adsenseClient();
}
