import { expect, test, type Page } from "@playwright/test";
import { addAnyImage, addFiles, makeImage, openApp, process, rows, waitForComplete, waitForReady } from "./helpers";

const TOOL_ROUTES = [
  { path: "/resize-image", heading: "Resize images" },
  { path: "/compress-image", heading: "Compress images" },
  { path: "/reduce-image-file-size", heading: "Reduce image file size" },
  { path: "/convert-to-webp", heading: "Convert to WebP" },
  { path: "/convert-to-jpg", heading: "Convert to JPG" },
  { path: "/convert-to-png", heading: "Convert to PNG" },
  { path: "/convert-to-avif", heading: "Convert to AVIF" },
  { path: "/bulk-image-resizer", heading: "Resize images in bulk" },
];

const PAGES = ["/", "/app", "/token", "/about", "/privacy", "/terms", ...TOOL_ROUTES.map((route) => route.path)];

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

test.describe("homepage", () => {
  test("explains the product and reaches the tool in one click @cross-browser @mobile", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Private compression tool.");
    // What it does is said in plain words, whatever the headline is.
    await expect(page.getByText("Compress, resize, crop and convert images locally in your browser.")).toBeVisible();
    // The way in is visible without scrolling.
    const cta = page.getByRole("link", { name: "Open JustResize" });
    await expect(cta).toBeInViewport();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);

    await cta.click();
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByRole("button", { name: /Choose images/ })).toBeVisible();
  });

  test("keeps crypto out of the product pitch", async ({ page }) => {
    await page.goto("/");
    const text = (await page.locator("main").innerText()).toLowerCase();
    for (const banned of ["buy now", "100x", "price", "market cap", "moon", "invest", "guaranteed", "passive income", "web3"]) {
      expect(text, `homepage must not say "${banned}"`).not.toContain(banned);
    }
    // The product is the main action; the token is a link to its own page, never something to buy.
    await expect(page.getByRole("link", { name: "Token details" })).toHaveAttribute("href", "/token");
    await expect(page.getByRole("link", { name: /buy|swap|trade|connect/i })).toHaveCount(0);
    await expect(page.locator('main a[href*="pump.fun"]')).toHaveCount(0);
  });

  test("before launch the token section publishes no address and no figures", async ({ page }) => {
    await page.goto("/");
    const section = page.locator("section", { has: page.getByRole("heading", { name: "JustResize × Solana" }) });
    await expect(section.getByText("Launching on pump.fun")).toBeVisible();
    await expect(section.locator("dt")).toHaveText(["Network", "Status"]);
    await expect(section.getByText("Always verify the official mint on JustResize before interacting with the token.")).toBeVisible();
    await expect(section.getByRole("link", { name: /pump\.fun/i })).toHaveCount(0);
    const text = await page.locator("main").innerText();
    expect(text).not.toMatch(/undefined|null|NaN|[1-9A-HJ-NP-Za-km-z]{32,44}|\d\s?%\s(of|to)\b|\$\d/);
  });

  test("the launch banner is one line and stays dismissed", async ({ page }) => {
    await page.goto("/");
    const banner = page.getByText("JustResize token launching on Solana.");
    await expect(banner).toBeVisible();
    await expect(banner.getByRole("link", { name: "Learn more" })).toHaveAttribute("href", "/token");
    await page.getByRole("button", { name: "Dismiss" }).click();
    await expect(banner).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: "Dismiss" })).toHaveCount(0);
  });

  test("the example size in the hero can be chosen, and every number follows", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const sizes = page.getByRole("group", { name: "Example output size" });
    await expect(sizes.getByRole("button", { name: "1600 × 1200" })).toHaveAttribute("aria-pressed", "true");
    await sizes.getByRole("button", { name: "1080 × 1350" }).click();
    await expect(sizes.getByRole("button", { name: "1080 × 1350" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("1080 × 1350 WebP 366 KB")).toBeVisible();
    await expect(page.getByText("94% smaller").first()).toBeVisible();
  });

  test("the figures play once when they are scrolled to, and end on their real values", async ({ page }) => {
    await page.goto("/");
    // The hero settles into place and stays there.
    await expect(page.getByRole("heading", { level: 1 })).toHaveCSS("opacity", "1");
    await expect(page.getByRole("heading", { name: "Unlimited images. No file size limit." })).toHaveCount(1);

    // Below the fold nothing has played yet; scrolling to a figure plays it, once.
    const figure = page.getByRole("img", { name: /84 images resized to fit 1600 pixels/ });
    const reveal = figure.locator("xpath=ancestor::*[@data-reveal][1]");
    await expect(reveal).not.toHaveAttribute("data-inview");
    await figure.scrollIntoViewIfNeeded();
    await expect(reveal).toHaveAttribute("data-inview", "");
    await expect(figure.getByText("84 images ready")).toHaveCSS("opacity", "1");

    // The file-size figure counts down to the result and stops exactly on it.
    const scale = page.getByRole("img", { name: /a 500 KB limit, and a 487 KB result/ });
    await scale.scrollIntoViewIfNeeded();
    await expect(scale.locator("span[aria-hidden]")).toHaveText("487 KB", { timeout: 10_000 });
  });

  test("with reduced motion every figure is simply there", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const figure = page.getByRole("img", { name: /84 images resized to fit 1600 pixels/ });
    await figure.scrollIntoViewIfNeeded();
    await expect(figure.getByText("84 images ready")).toHaveCSS("opacity", "1");
    const scale = page.getByRole("img", { name: /a 500 KB limit, and a 487 KB result/ });
    await scale.scrollIntoViewIfNeeded();
    await expect(scale.locator("span[aria-hidden]")).toHaveText("487 KB");
  });

  test("the example pictures are real photographs, served by the site itself", async ({ page, request }) => {
    await page.goto("/");
    const photos = page.locator('img[src^="/samples/"]');
    expect(await photos.count()).toBeGreaterThanOrEqual(8);
    for (const src of new Set(await photos.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("src")!)))) {
      const response = await request.get(src);
      expect(response.status(), src).toBe(200);
      expect(response.headers()["content-type"], src).toBe("image/webp");
    }
    // Each output size shows the next photograph, under its own file name.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload();
    await expect(page.getByText("IMG_2041.jpg").first()).toBeVisible();
    await page.getByRole("group", { name: "Example output size" }).getByRole("button", { name: "1080 × 1080" }).click();
    await expect(page.getByText("IMG_2043.jpg").first()).toBeVisible();
  });

  test("answers the common questions, in words that match its structured data", async ({ page }) => {
    await page.goto("/");
    const section = page.locator("section", { has: page.getByRole("heading", { name: "Questions" }) });
    const shown = await section.locator("dt").allInnerTexts();
    expect(shown.length).toBeGreaterThanOrEqual(4);
    // On a wide screen every answer is showing, and the questions are the last thing before the footer.
    await expect(section.getByText("JustResize has no server that receives images.")).toBeVisible();
    await expect(section.getByRole("button")).toHaveCount(0);
    expect(await page.locator("main > section").last().getAttribute("aria-labelledby")).toBe("questions-heading");
    const blocks = await page.evaluate(() => [...document.querySelectorAll('script[type="application/ld+json"]')].map((node) => JSON.parse(node.textContent ?? "{}")));
    expect(blocks.find((block) => block["@type"] === "FAQPage").mainEntity.map((entry: { name: string }) => entry.name)).toEqual(shown);
    expect(blocks.map((block) => block["@type"]).sort()).toEqual(["FAQPage", "Organization", "WebApplication", "WebSite"]);
  });

  test("the whole page fits a phone without sideways scrolling @mobile", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.getByRole("heading", { name: "JustResize × Solana" })).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
  });

  test("on a phone the navigation is a menu, and the questions open one at a time @mobile", async ({ page, isMobile }) => {
    test.skip(!isMobile, "phone layout only");
    await page.goto("/");
    // The header is one line: name, the way into the tool, and the menu.
    await expect(page.getByRole("navigation", { name: "Site" })).toHaveCount(0);
    expect((await page.getByRole("banner").boundingBox())!.height).toBeLessThanOrEqual(58);
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    const menu = page.getByRole("dialog", { name: "Menu" });
    await expect(menu).toBeVisible();
    for (const name of ["Tool", "How it works", "Token", "About"]) await expect(menu.getByRole("link", { name, exact: true })).toHaveCount(1);
    await expect(menu.getByRole("link", { name: "Open JustResize" })).toBeVisible();

    // Escape closes it; a link closes it and goes there.
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await menu.getByRole("link", { name: "About", exact: true }).click();
    await expect(page).toHaveURL(/\/about$/);
    await expect(page.getByRole("dialog", { name: "Menu" })).toBeHidden();

    // Questions: collapsed until asked, and opening one closes the other.
    await page.goto("/");
    const section = page.locator("section", { has: page.getByRole("heading", { name: "Questions" }) });
    const first = section.getByRole("button", { name: "Is JustResize free?" });
    const second = section.getByRole("button", { name: "Are my images uploaded?" });
    const answer = section.getByText("JustResize has no server that receives images.");
    await first.scrollIntoViewIfNeeded();
    await expect(answer).toBeHidden();
    await second.click();
    await expect(second).toHaveAttribute("aria-expanded", "true");
    await expect(answer).toBeVisible();
    await first.click();
    await expect(second).toHaveAttribute("aria-expanded", "false");
    await expect(answer).toBeHidden();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
  });

  test("images dropped on the homepage open in the tool", async ({ page }) => {
    await page.goto("/");
    const file = await makeImage(page, { name: "from-home.png", width: 300, height: 200, type: "image/png" });
    const dataTransfer = await page.evaluateHandle(({ base64, name, type }) => {
      const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
      const transfer = new DataTransfer();
      transfer.items.add(new File([bytes], name, { type }));
      return transfer;
    }, { base64: file.buffer.toString("base64"), name: file.name, type: file.mimeType });

    await page.dispatchEvent("body", "dragenter", { dataTransfer });
    await expect(page.getByText("Drop images to open them in JustResize")).toBeVisible();
    await page.dispatchEvent("body", "dragover", { dataTransfer });
    await page.dispatchEvent("body", "drop", { dataTransfer });

    await expect(page).toHaveURL(/\/app$/);
    await waitForReady(page, 1);
    await expect(rows(page).first()).toContainText("from-home.png");
  });
});

test.describe("the tool's frame", () => {
  test("the app bar links back to the site without getting in the way", async ({ page }) => {
    await openApp(page);
    const nav = page.getByRole("navigation", { name: "Site" });
    await expect(nav.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
    await expect(nav.getByRole("link", { name: "Token" })).toHaveAttribute("href", "/token");
    await expect(page.getByRole("button", { name: "Local processing" })).toBeVisible();
    const header = (await page.getByRole("banner").boundingBox())!;
    expect(header.height).toBeLessThanOrEqual(49);
  });

  test("an empty workspace is just the place to add images", async ({ page }) => {
    await openApp(page);
    await expect(page.getByRole("complementary", { name: "Resize settings" })).toHaveCount(0);
    await addAnyImage(page);
    await expect(page.getByRole("complementary", { name: "Resize settings" })).toBeVisible();
  });

  for (const route of TOOL_ROUTES) {
    test(`${route.path} is a working tool page with its own content`, async ({ page }) => {
      await openApp(page, route.path);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(route.heading);
      // The tool comes first; the page's own text is below it.
      const tool = (await page.getByRole("button", { name: /Choose images/ }).boundingBox())!;
      const content = (await page.getByRole("heading", { name: "Questions" }).boundingBox())!;
      expect(tool.y).toBeLessThan(content.y);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `https://justresize.com${route.path}`);

      // FAQ structured data matches the questions actually on the page.
      const faq = await page.evaluate(() => {
        const blocks = [...document.querySelectorAll('script[type="application/ld+json"]')].map((node) => JSON.parse(node.textContent ?? "{}"));
        return blocks.find((block) => block["@type"] === "FAQPage")?.mainEntity.map((entry: { name: string }) => entry.name) ?? [];
      });
      const shown = await page.locator("dl dt").allInnerTexts();
      expect(faq.length).toBeGreaterThan(0);
      expect(faq).toEqual(shown);
    });
  }
});

test.describe("token page", () => {
  test("before launch it publishes no address, and lists only what exists", async ({ page }) => {
    await page.goto("/token");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("JustResize on Solana");
    await expect(page.getByTestId("token-status")).toHaveText("Coming soon");
    await expect(page.locator("#official dt")).toHaveText(["Status", "Network", "Ticker", "Launch platform", "Official website", "Official X"]);
    await expect(page.locator("#official")).toContainText("$SIZE");
    await expect(page.locator("#official").getByRole("link", { name: "x.com/justresize" })).toHaveAttribute("href", "https://x.com/justresize");
    await expect(page.getByText("Only use an address published on justresize.com/token.")).toBeVisible();

    // Nothing that could be mistaken for an address, and nothing to trade.
    await expect(page.getByTestId("token-address")).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Solscan/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /copy|connect|buy|swap/i })).toHaveCount(0);
    const text = await page.locator("main").innerText();
    expect(text).not.toMatch(/undefined|null|NaN|0x[0-9a-f]{4}|[1-9A-HJ-NP-Za-km-z]{32,44}/);

    // No token, so no market: there is no activity to chart, here or in the homepage hero.
    await expect(page.getByTestId("token-activity")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Activity" })).toHaveCount(0);

    // What the project does with the money the site makes is ordinary readable text, not fine print.
    const statement = page.getByText("Any money the site makes, from advertising or anything else, will be put into the token.");
    await expect(statement).toBeVisible();
    expect(await statement.evaluate((node) => parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(15);
    // The risk disclosure is in the terms.
    await page.goto("/terms");
    await expect(page.getByText("Cryptoassets are volatile and can lose all of their value.")).toBeVisible();
  });

  test("reads well on a phone @mobile", async ({ page }) => {
    await page.goto("/token");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
  });
});

test.describe("site pages", () => {
  test("about, privacy and terms exist and say what they must", async ({ page }) => {
    await page.goto("/about");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("About JustResize");

    await page.goto("/privacy");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Privacy");
    await expect(page.getByRole("heading", { name: "Advertising and cookies" })).toBeVisible();
    await expect(page.getByText("Advertising never involves your images.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "What the web host sees" })).toBeVisible();

    await page.goto("/terms");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Terms");
    await expect(page.locator("#token")).toHaveText("The project token");
  });

  test("an unknown address gets a useful 404", async ({ page }) => {
    const response = await page.goto("/definitely-not-a-page");
    expect(response?.status()).toBe(404);
    await expect(page.getByText("404 × 404")).toBeVisible();
    await page.getByRole("link", { name: "Open JustResize" }).click();
    await expect(page).toHaveURL(/\/app$/);
  });

  test("every page has its own title, description, canonical and share image", async ({ page }) => {
    const titles = new Set<string>();
    for (const path of PAGES) {
      await page.goto(path);
      const title = await page.title();
      expect(title.length, `${path} title`).toBeGreaterThan(10);
      titles.add(title);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `https://justresize.com${path === "/" ? "" : path}`);
      expect((await page.locator('meta[name="description"]').getAttribute("content"))!.length, `${path} description`).toBeGreaterThan(50);
      // The site's share image, the token's, or a tool page's own.
      const image = (await page.locator('meta[property="og:image"]').getAttribute("content"))!;
      expect(image, `${path} share image`).toMatch(/^https:\/\/justresize\.com\/brand\/(justresize-(token-)?og|og\/[a-z0-9-]+)\.png$/);
      expect(await page.locator('meta[name="twitter:image"]').getAttribute("content"), `${path} X card image`).toBe(image);
      await expect(page.locator('meta[property="og:image:alt"]')).toHaveAttribute("content", /JustResize/);
      expect((await page.request.get(new URL(image).pathname)).status(), image).toBe(200);
      await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    }
    expect(titles.size).toBe(PAGES.length);

    // Each tool page is shared with an image that says what that page does.
    for (const route of TOOL_ROUTES) {
      await page.goto(route.path);
      await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", `https://justresize.com/brand/og${route.path}.png`);
    }
  });

  test("sitemap, robots, manifest and share images are served", async ({ request }) => {
    const sitemap = await (await request.get("/sitemap.xml")).text();
    for (const path of PAGES) expect(sitemap).toContain(`<loc>https://justresize.com${path === "/" ? "" : path}</loc>`);

    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain("Allow: /");
    expect(robots).toContain("Sitemap: https://justresize.com/sitemap.xml");

    const manifest = await (await request.get("/manifest.webmanifest")).json();
    expect(manifest.start_url).toBe("/app");
    for (const icon of manifest.icons) expect((await request.get(icon.src)).status()).toBe(200);

    for (const asset of ["/brand/justresize-og.png", "/brand/justresize-token-og.png", "/favicon.ico", "/icon.svg", "/apple-icon.png"]) {
      expect((await request.get(asset)).status(), asset).toBe(200);
    }

    const ads = await request.get("/ads.txt");
    expect(ads.headers()["content-type"]).toContain("text/plain");
    expect(await ads.text()).toMatch(/^google\.com, pub-\d+, DIRECT, f08c47fec0942fa0\n$/);
  });
});

test.describe("advertising", () => {
  // This suite builds with NEXT_PUBLIC_ADS=off (playwright.config.ts), so it never depends on Google's servers.
  // The policy an ad-carrying build sends is covered by the unit tests for lib/config/csp.ts.
  test("is absent from a build made without it: no ad script, and the strict policy", async ({ page, request }) => {
    const requests: string[] = [];
    page.on("request", (entry) => requests.push(entry.url()));
    await page.goto("/");
    await expect(page.locator('script[src*="googlesyndication"]')).toHaveCount(0);
    await page.goto("/app");
    await expect(page.getByRole("button", { name: /Choose images/ })).toBeVisible();
    const origin = new URL(page.url()).origin;
    expect(requests.filter((url) => !url.startsWith(origin) && !url.startsWith("data:") && !url.startsWith("blob:"))).toEqual([]);
    expect((await request.get("/")).headers()["content-security-policy"]).not.toMatch(/google|doubleclick/);
  });
});

test.describe("security headers", () => {
  test("are sent on every page", async ({ request }) => {
    for (const path of ["/", "/app", "/token"]) {
      const headers = (await request.get(path)).headers();
      expect(headers["content-security-policy"]).toContain("connect-src 'self'");
      expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
      expect(headers["x-content-type-options"]).toBe("nosniff");
      expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
      expect(headers["x-powered-by"]).toBeUndefined();
    }
  });

  test("do not block the workers, the WASM codecs, previews or downloads @cross-browser", async ({ page }) => {
    await page.addInitScript(() => {
      const violations: string[] = [];
      (window as unknown as { __violations: string[] }).__violations = violations;
      document.addEventListener("securitypolicyviolation", (event) => violations.push(`${event.violatedDirective} ${event.blockedURI}`));
    });
    await openApp(page);
    await addFiles(page, [await makeImage(page, { name: "photo.jpg", width: 640, height: 480, type: "image/jpeg" })]);
    await waitForReady(page, 1);

    // AVIF goes through the WASM encoder in every browser, in a worker.
    await page.getByLabel("Format").selectOption("avif");
    await process(page);
    await waitForComplete(page, 1, 90_000);
    await expect(rows(page).first()).toContainText("AVIF");

    expect(await page.evaluate(() => (window as unknown as { __violations: string[] }).__violations)).toEqual([]);
  });
});
