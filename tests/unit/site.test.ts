import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET as adsTxt } from "@/app/ads.txt/route";
import sitemap from "@/app/sitemap";
import { activeAdsenseClient, adsenseClient } from "@/lib/ads";
import { contentSecurityPolicy } from "@/lib/config/csp";
import { SITE, TOKEN_CONFIG } from "@/lib/config/site";
import { toolOgImage } from "@/lib/seo";
import { sanitizeConfig } from "@/lib/settings/schema";
import { createDefaultConfig } from "@/lib/settings/defaults";
import { APP_TOOL, findTool, TOOLS } from "@/lib/tools/definitions";

/** Routes that exist as their own pages; a tool slug must never shadow one. */
const STATIC_ROUTES = ["app", "token", "about", "privacy", "terms", "brand", "sitemap.xml", "robots.txt", "ads.txt"];

describe("site config", () => {
  it("has a production origin without a trailing slash", () => {
    expect(SITE.url).toMatch(/^https:\/\/[a-z0-9.-]+$/);
  });

  it("only holds links that could be rendered as they are", () => {
    for (const value of [SITE.links.x, SITE.links.github, TOKEN_CONFIG.telegramUrl, TOKEN_CONFIG.discordUrl, TOKEN_CONFIG.explorerUrl, TOKEN_CONFIG.launchPlatform.url]) {
      if (value !== "") expect(value).toMatch(/^https:\/\//);
    }
    if (SITE.contactEmail !== "") expect(SITE.contactEmail).toMatch(/^[^@\s]+@[^@\s]+\.[^@\s]+$/);
  });

  it("links to no trading venue before there is a token to link to", () => {
    if (TOKEN_CONFIG.status === "prelaunch") expect(TOKEN_CONFIG.launchPlatform.url).toBe("");
  });
});

afterEach(() => vi.unstubAllEnvs());

describe("advertising", () => {
  it("is configured with a real-looking publisher ID, or not at all", () => {
    if (SITE.adsenseClient !== "") expect(SITE.adsenseClient).toMatch(/^ca-pub-\d{10,20}$/);
    expect(adsenseClient()).toBe(SITE.adsenseClient === "" ? null : SITE.adsenseClient);
  });

  it("loads only in a production build that has not switched it off", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(activeAdsenseClient()).toBeNull();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_ADS", "");
    vi.stubEnv("VERCEL_ENV", "");
    expect(activeAdsenseClient()).toBe(adsenseClient());
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(activeAdsenseClient()).toBeNull();
    vi.stubEnv("VERCEL_ENV", "production");
    expect(activeAdsenseClient()).toBe(adsenseClient());
    vi.stubEnv("NEXT_PUBLIC_ADS", "off");
    expect(activeAdsenseClient()).toBeNull();
  });

  it("publishes an ads.txt that names the same publisher", async () => {
    const response = adsTxt();
    const client = adsenseClient();
    if (!client) return expect(response.status).toBe(404);
    expect(await response.text()).toBe(`google.com, ${client.replace("ca-", "")}, DIRECT, f08c47fec0942fa0\n`);
  });
});

describe("content security policy", () => {
  const directive = (policy: string, name: string) => policy.split("; ").find((part) => part.startsWith(`${name} `));

  it("without ads lets the page talk to nothing but this site", () => {
    const policy = contentSecurityPolicy({ dev: false, ads: false });
    expect(directive(policy, "connect-src")).toBe("connect-src 'self'");
    expect(directive(policy, "script-src")).toBe("script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'");
    expect(directive(policy, "img-src")).toBe("img-src 'self' blob: data:");
    expect(directive(policy, "frame-src")).toBeUndefined();
    expect(policy).not.toMatch(/google|doubleclick/);
    expect(policy).toContain("frame-ancestors 'none'");
  });

  it("with ads adds Google's ad origins and loosens nothing else", () => {
    const strict = contentSecurityPolicy({ dev: false, ads: false }).split("; ");
    const policy = contentSecurityPolicy({ dev: false, ads: true });
    expect(directive(policy, "script-src")).toContain("https://*.googlesyndication.com");
    expect(directive(policy, "frame-src")).toContain("https://*.doubleclick.net");
    expect(directive(policy, "connect-src")).toContain("https://*.google.com");
    for (const name of ["script-src", "connect-src", "frame-src"]) {
      // Named hosts only: no wildcard scheme, and never eval.
      expect(directive(policy, name)).not.toMatch(/ https:( |$)| \*( |$)|'unsafe-eval'/);
    }
    for (const name of ["default-src", "style-src", "font-src", "worker-src", "object-src", "base-uri", "form-action", "frame-ancestors"]) {
      expect(directive(policy, name)).toBe(strict.find((part) => part.startsWith(`${name} `)));
    }
  });
});

describe("tool pages", () => {
  it("have unique slugs, titles and headings' worth of content", () => {
    const all = [APP_TOOL, ...TOOLS];
    expect(new Set(all.map((tool) => tool.slug)).size).toBe(all.length);
    expect(new Set(all.map((tool) => tool.title)).size).toBe(all.length);
    expect(new Set(TOOLS.map((tool) => tool.description)).size).toBe(TOOLS.length);
    for (const tool of TOOLS) {
      expect(STATIC_ROUTES).not.toContain(tool.slug);
      expect(tool.slug).toMatch(/^[a-z0-9-]+$/);
      expect(tool.sections?.length, tool.slug).toBeGreaterThan(0);
      expect(tool.faq?.length, tool.slug).toBeGreaterThan(0);
      expect(findTool(tool.slug)).toBe(tool);
    }
  });

  it("each have their own share image on disk", () => {
    // Made by `npm run brand:export`. A new tool page without one would be shared with a broken image.
    for (const tool of TOOLS) {
      expect(toolOgImage(tool).url).toBe(`/brand/og/${tool.slug}.png`);
      expect(existsSync(fileURLToPath(new URL(`../../public/brand/og/${tool.slug}.png`, import.meta.url))), tool.slug).toBe(true);
    }
  });

  it("open with settings the app accepts unchanged", () => {
    for (const tool of TOOLS) {
      const config = { ...createDefaultConfig(), ...tool.initialConfig };
      expect(sanitizeConfig(structuredClone(config)), tool.slug).toEqual(config);
    }
  });

  it("do something different from each other on arrival", () => {
    const presets = TOOLS.map((tool) => JSON.stringify(tool.initialConfig));
    expect(new Set(presets).size).toBe(TOOLS.length);
  });
});

describe("sitemap", () => {
  it("lists every public page once, on the production origin", () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(new Set(urls).size).toBe(urls.length);
    for (const path of ["", "/app", "/about", "/privacy", "/terms", ...TOOLS.map((tool) => `/${tool.slug}`)]) {
      expect(urls).toContain(`${SITE.url}${path}`);
    }
    expect(urls.includes(`${SITE.url}/token`)).toBe(TOKEN_CONFIG.enabled);
  });
});
