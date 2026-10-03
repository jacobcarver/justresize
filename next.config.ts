import type { NextConfig } from "next";
import { activeAdsenseClient } from "./lib/ads";
import { contentSecurityPolicy as buildContentSecurityPolicy } from "./lib/config/csp";

const isDev = process.env.NODE_ENV !== "production";
// Vercel sets VERCEL_ENV at build time: "production", "preview" or "development".
const isPreview = !!process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production";

// The policy itself, and why each part is there, is in lib/config/csp.ts.
const contentSecurityPolicy = buildContentSecurityPolicy({ dev: isDev, ads: activeAdsenseClient() !== null });

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          // The tool needs none of these device features, so no script on the page can ask for them.
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()" },
          ...(isPreview ? [{ key: "X-Robots-Tag", value: "noindex" }] : []),
        ],
      },
    ];
  },
};

export default nextConfig;
