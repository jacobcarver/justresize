/**
 * The Content-Security-Policy, as a function of what the build includes.
 *
 * Without ads the site is static pages plus code that runs in the browser,
 * so the policy is strict about where anything may come from or go to:
 *
 * - connect-src 'self': the page may not send data to any other origin.
 * - 'wasm-unsafe-eval' lets the WebP/AVIF encoders compile; blob: covers
 *   thumbnails, result previews and downloads; workers load from this origin.
 * - 'unsafe-inline' is needed for the inline bootstrap data Next.js writes
 *   into prerendered pages (a nonce would force every page to render on demand).
 *
 * With ads, Google's ad origins are added to the script, frame, image and
 * connect lists, and nothing else is loosened. Google documents a
 * nonce-based policy for AdSense rather than a list of hosts, which static
 * pages cannot use, so this list is the hosts its script is known to use.
 * If an ad or the consent message is blocked on the live site, the console
 * names the origin to add here.
 *
 * Adding any other third-party script, font or endpoint means adding its
 * origin here, and saying so on /privacy.
 */

const GOOGLE_ADS = [
  "https://*.googlesyndication.com",
  "https://*.doubleclick.net",
  "https://*.google.com",
  "https://*.adtrafficquality.google",
];

const ADS = {
  script: [...GOOGLE_ADS, "https://*.gstatic.com", "https://www.googletagservices.com"],
  frame: GOOGLE_ADS,
  // Ad and measurement pixels come from Google's per-country hosts (google.co.uk, google.de, …), which a host list cannot enumerate.
  img: ["https:"],
  connect: [...GOOGLE_ADS, "https://*.gstatic.com"],
};

export function contentSecurityPolicy({ dev, ads }: { dev: boolean; ads: boolean }): string {
  const list = (base: string, extra: string[]) => [base, ...(ads ? extra : [])].join(" ");

  return [
    "default-src 'self'",
    list(`script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${dev ? " 'unsafe-eval'" : ""}`, ADS.script),
    "style-src 'self' 'unsafe-inline'",
    list("img-src 'self' blob: data:", ADS.img),
    "font-src 'self'",
    list(`connect-src 'self'${dev ? " ws:" : ""}`, ADS.connect),
    ...(ads ? [`frame-src ${ADS.frame.join(" ")}`] : []),
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}
