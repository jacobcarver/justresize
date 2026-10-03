import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import { activeAdsenseClient } from "@/lib/ads";
import { SITE } from "@/lib/config/site";
import { HOME_TITLE, OG_IMAGE } from "@/lib/seo";
import "./globals.css";

// Self-hosted at build time: the browser never contacts a font service.
// One family for everything. It is a variable font with a width axis: display type is set
// condensed (.type-display in globals.css), and measurements use its tabular figures.
const sans = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-sans-face", display: "swap" });

// Defaults only. Every page builds its own complete set with pageMetadata() (lib/seo.ts).
export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: HOME_TITLE,
    template: "%s — JustResize",
  },
  description: SITE.description,
  applicationName: SITE.name,
  openGraph: { type: "website", siteName: SITE.name, locale: "en_US", images: [OG_IMAGE] },
  twitter: { card: "summary_large_image", images: [OG_IMAGE] },
  formatDetection: { telephone: false },
  verification: SITE.googleSiteVerification ? { google: SITE.googleSiteVerification } : undefined,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets the fixed action bar pad itself above the iOS home indicator.
  viewportFit: "cover",
  themeColor: "#0e0f11",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const adsClient = activeAdsenseClient();

  return (
    <html lang="en" className={`${sans.variable} h-full antialiased`}>
      {/*
        Google AdSense, exactly as Google supplies it. A plain script tag, not next/script:
        AdSense warns about the attribute next/script adds. It is the site's only third-party
        code, and it is absent unless lib/ads.ts says this build carries ads.
      */}
      {adsClient && (
        <head>
          <script async src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsClient}`} crossOrigin="anonymous" />
        </head>
      )}
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
