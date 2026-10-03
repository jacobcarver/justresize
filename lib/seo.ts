/**
 * Page metadata and structured data, built the same way for every route.
 *
 * Next merges metadata shallowly: a page that sets `openGraph` replaces the
 * layout's whole object. Building the complete set here means no page can
 * end up with a title but no share image, or a canonical that points at
 * another page.
 */
import type { Metadata } from "next";
import { SITE } from "@/lib/config/site";

/** The homepage's title, and the default for any page that sets none. */
export const HOME_TITLE = "JustResize — Private image compressor and resizer, no upload";

export const OG_IMAGE = { url: "/brand/justresize-og.png", width: 1200, height: 630, alt: "JustResize. Private compression tool." };

/** A tool page's own share image: its heading and description, made by `npm run brand:export` for every entry in lib/tools/definitions.ts. */
export function toolOgImage(tool: { slug: string; heading: string; description: string }): typeof OG_IMAGE {
  return { url: `/brand/og/${tool.slug}.png`, width: 1200, height: 630, alt: `JustResize. ${tool.heading}: ${tool.description}` };
}
export const TOKEN_OG_IMAGE = { url: "/brand/justresize-token-og.png", width: 1200, height: 630, alt: "JustResize on Solana. Official token information." };

interface PageMetadataInput {
  /** Used as written; the site name is not appended. */
  title: string;
  description: string;
  /** Path of the page itself, e.g. "/compress-image". Becomes the canonical, so query-string variants never index separately. */
  path: string;
  image?: typeof OG_IMAGE;
  noindex?: boolean;
}

export function pageMetadata({ title, description, path, image = OG_IMAGE, noindex = false }: PageMetadataInput): Metadata {
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: path },
    robots: noindex ? { index: false, follow: true } : undefined,
    openGraph: {
      type: "website",
      siteName: SITE.name,
      title,
      description,
      url: path,
      locale: "en_US",
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export function absoluteUrl(path: string): string {
  return path === "/" ? SITE.url : `${SITE.url}${path}`;
}

type JsonLdObject = Record<string, unknown>;

const ORGANIZATION_ID = `${SITE.url}/#organization`;

/** What the engine does, as search engines list an application's features. Every line must be true of lib/image/. */
const FEATURE_LIST = [
  "Compress JPEG, PNG, WebP and AVIF images",
  "Resize to exact pixel dimensions, a maximum size or a percentage",
  "Reduce an image to a file-size limit such as 500 KB",
  "Convert between JPEG, PNG, WebP and AVIF",
  "Crop to an aspect ratio",
  "Process batches and download them as one ZIP",
  "Runs in the browser: images are not uploaded",
];

/** The tool itself. Free, runs in a browser: nothing more is claimed. */
export function webApplicationLd({ path, name, description }: { path: string; name: string; description: string }): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name,
    url: absoluteUrl(path),
    description,
    image: absoluteUrl(OG_IMAGE.url),
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Any",
    browserRequirements: "Requires JavaScript and a current browser.",
    featureList: FEATURE_LIST,
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    publisher: { "@id": ORGANIZATION_ID },
  };
}

/** Who publishes the site: its name, logo and official profiles. Profiles with no configured value are left out. */
export function organizationLd(): JsonLdObject {
  const profiles = [SITE.links.x, SITE.links.github].filter((url) => url !== "");
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
    name: SITE.name,
    url: SITE.url,
    logo: absoluteUrl("/brand/justresize-icon-512.png"),
    ...(profiles.length > 0 ? { sameAs: profiles } : {}),
  };
}

export function webSiteLd(): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE.name,
    url: SITE.url,
    description: SITE.description,
    publisher: { "@id": ORGANIZATION_ID },
  };
}

export function breadcrumbLd(trail: { name: string; path: string }[]): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((entry, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: entry.name,
      item: absoluteUrl(entry.path),
    })),
  };
}

/** Only for pages that show these same questions and answers. */
export function faqLd(faq: { question: string; answer: string }[]): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((entry) => ({
      "@type": "Question",
      name: entry.question,
      acceptedAnswer: { "@type": "Answer", text: entry.answer },
    })),
  };
}
