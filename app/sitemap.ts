import type { MetadataRoute } from "next";
import { SITE, TOKEN_CONFIG } from "@/lib/config/site";
import { absoluteUrl } from "@/lib/seo";
import { TOOLS } from "@/lib/tools/definitions";

/** Every page that should be found, and nothing else. Query-string variants are covered by each page's canonical. */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = SITE.legal.lastUpdated;
  const page = (path: string, priority: number): MetadataRoute.Sitemap[number] => ({ url: absoluteUrl(path), lastModified, priority });

  return [
    page("/", 1),
    page("/app", 0.9),
    ...TOOLS.map((tool) => page(`/${tool.slug}`, 0.8)),
    page("/about", 0.5),
    ...(TOKEN_CONFIG.enabled ? [page("/token", 0.5)] : []),
    page("/privacy", 0.3),
    page("/terms", 0.3),
  ];
}
