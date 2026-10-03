import type { MetadataRoute } from "next";
import { SITE } from "@/lib/config/site";

/**
 * Production is indexable. Vercel preview deployments are not: they set
 * VERCEL_ENV to "preview", and a copy of the site on a throwaway URL has no
 * business in search results. (next.config.ts adds a noindex header there too.)
 */
export default function robots(): MetadataRoute.Robots {
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
