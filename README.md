# JustResize

Resize, crop, compress and convert images in the browser. Batch processing, exact
file-size targets ("make this under 500 KB"), multiple outputs per image, ZIP export.

**Images never leave the device.** There is no backend: decoding, resizing and
encoding all happen locally, in Web Workers. The app deploys as static pages.

The repository holds three things: the **tool** (`/app` and the tool pages), the
**public site** around it (homepage, about, privacy, terms, 404), and the
**project token's information page** (`/token`), which is configuration-driven
and has no wallet, trading or blockchain code. The product comes first: nothing
about the token touches the tool.

Related documents: [`BRAND.md`](BRAND.md) (identity, voice, assets),
[`TOKEN-LAUNCH-CHECKLIST.md`](TOKEN-LAUNCH-CHECKLIST.md) (what to verify before
the token goes live — **legal review recommended**),
[`brand-assets/social-copy.md`](brand-assets/social-copy.md) (launch posts).

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm run start` | Production build / serve it |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no emit |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | End-to-end tests (Playwright) against a fresh production build |
| `npm run brand:export` | Rebuilds every brand asset (wordmarks, icons, share images, social graphics) from source |

First e2e run: `npx playwright install chromium webkit firefox`.
To run e2e against something already running: `E2E_BASE_URL=http://localhost:3000 npm run test:e2e`.

`npm run test:e2e` reuses a server already listening on port 3100. After changing
app code, stop it first (`pkill -f "next start"`) so the tests build and serve the
new code instead of the old build.

No environment variables are required. Optional ones:

| Variable | Effect |
| --- | --- |
| `NEXT_PUBLIC_ANALYTICS_ENABLED=true` | Lets `lib/analytics.ts` forward events to a sink (none is registered by default) |
| `NEXT_PUBLIC_DEBUG=true` | Timing logs and the debug panel in a production build |
| `NEXT_PUBLIC_TOKEN_PREVIEW=live` | **Development only.** Shows the token as live with obviously fake values. Ignored by production builds |
| `NEXT_PUBLIC_ADS=off` | Set at build time: a production build without the AdSense script and with the strict CSP. The e2e suite builds this way |

There are no secrets. Token addresses and social links are public facts and live
in `lib/config/site.ts`, not in environment variables.

Debug mode can also be switched on for one browser in production:
`localStorage.setItem("justresize:debug", "1")`, then reload.

## Deploying to Vercel

```bash
npm install
npm run build
vercel
```

Nothing else: no database, storage, auth, server-side image processing or API routes.
Every route is prerendered. The worker script and the WASM codecs are emitted as
static assets by the build. Once the token is live, `/` and `/token` are
re-rendered at most every five minutes to refresh the activity chart (ISR);
until then they are plain static pages.

After the first deploy, check on the deployed URL that an image resizes (worker
loads), that AVIF output works (WASM loads), and that the browser console shows
no Content-Security-Policy errors.

- **Security headers** are set in `next.config.ts`: a Content-Security-Policy
  (built in `lib/config/csp.ts`), `Referrer-Policy`, `X-Content-Type-Options`,
  `X-Frame-Options` and `Permissions-Policy`. Without ads the policy is
  `connect-src 'self'`: the page may not send data to any other origin. With
  ads it also allows Google's ad origins for scripts, frames, images and
  connections, and nothing else. Adding any other third-party script, font or
  endpoint means adding its origin there, and updating `/privacy`.
- **Advertising.** `SITE.adsenseClient` switches on Google AdSense: the loader
  script in the root layout, `/ads.txt`, the wider CSP and the advertising
  section of `/privacy` all follow from it (`lib/ads.ts`). Only the loader is
  installed, so placement is Auto ads, configured in the AdSense console. Do
  three things there: add the site, turn on the consent message for the EEA,
  UK and Switzerland (Google requires one to serve ads there), and exclude
  `/app` or switch off anchor and vignette formats so no ad sits near a
  download control. After the first deploy, check the console for CSP errors
  once real ads are serving: Google's hosts change, and only localhost (where
  no ads serve) has been tested.
- **Preview deployments are not indexed**: when `VERCEL_ENV` is not
  `production`, `robots.txt` disallows everything and an `X-Robots-Tag: noindex`
  header is sent. Vercel's preview toolbar is blocked by the CSP on previews;
  that is expected.
- `SITE.url` in `lib/config/site.ts` is the production origin used for
  canonicals, the sitemap and share images. Change it if the domain changes.

## Routes

| Route | What it is |
| --- | --- |
| `/` | Public homepage. Dropping images on it opens them in the tool |
| `/app` | The workspace |
| `/resize-image` | Tool page: opens in Dimensions mode |
| `/compress-image` | Tool page: file-size target of 1 MB, "Compress only" (dimensions kept) |
| `/reduce-image-file-size` | Tool page: file-size target of 500 KB, "Smart" |
| `/convert-to-webp` | Tool page: WebP output |
| `/convert-to-jpg`, `/convert-to-png`, `/convert-to-avif` | Tool pages: JPEG, PNG and AVIF output |
| `/bulk-image-resizer` | Tool page: Max size 1920 px |
| `/token` | Token information and risk disclosure |
| `/about`, `/privacy`, `/terms` | Project story, privacy policy, terms (`/terms#token` is the token disclosure) |
| `/sitemap.xml`, `/robots.txt`, `/manifest.webmanifest` | Generated from the same route data |
| `/ads.txt` | Generated from `SITE.adsenseClient`; 404 when there is none |
| anything else | `app/not-found.tsx` (404 × 404) |

Every page builds its metadata with `pageMetadata()` in `lib/seo.ts`: a unique
title and description, a canonical URL (so query-string variants such as
`/app?width=1200` never index separately), Open Graph and X card tags, and a
share image. Structured data (`Organization`, `WebSite`, `WebApplication`,
`BreadcrumbList`, and `FAQPage` only where the questions are on the page) comes
from the same file.

Search: the on-page work is done (titles, descriptions, canonicals, sitemap,
structured data, one landing page per job). What is left happens outside the
code: verify the domain in Google Search Console (DNS, or put the HTML-tag value
in `SITE.googleSiteVerification`), submit `/sitemap.xml`, and earn links. A new
domain does not rank for "compress image" on markup alone.

## Site configuration

One file, `lib/config/site.ts`, holds every fact that is not code. Two rules are
enforced wherever it is read: **an empty value is never rendered** (no dead
links, no "undefined"), and **no address is ever shown unless it is a real one**.

`SITE`:

| Field | Effect |
| --- | --- |
| `url` | Production origin |
| `links.x`, `links.github` | Footer "Social" column and the token page's "Official X". Empty = not shown |
| `contactEmail` | Contact section on `/privacy` and `/terms`. Empty = no contact section |
| `legal.operator`, `legal.jurisdiction` | Named in `/terms`. Empty = "the JustResize project", no governing-law section |
| `legal.lastUpdated` | "Last updated" on the legal pages, and `lastmod` in the sitemap |
| `adsenseClient` | Google AdSense publisher ID (`ca-pub-…`). Empty = no ad script, no `/ads.txt`, strict CSP, and `/privacy` says there is no advertising |
| `googleSiteVerification` | Search Console "HTML tag" value. Empty = no tag |
| `launchBanner` | `true` shows the one-line dismissible banner above the homepage (only there, and only while the token is enabled). Its wording follows the token's status: "JustResize token launching on Solana. Learn more" before launch, "The official $TICKER token is live. View now" after |

### Token configuration

`TOKEN_CONFIG` in the same file drives `/token`, the homepage's token section,
the links to the page, its sitemap entry and the token graphics.

- **Launch status** — `status` is `"prelaunch"`, `"live"`, `"paused"` or
  `"deprecated"`. Pre-launch shows "Coming soon" and **no address at all**,
  whatever else is filled in. The name, ticker and mint rows only appear once
  they exist.
- **Set the official mint** — put the address in `mintAddress`, fill in `name`
  and `ticker`, then set `status: "live"`. The address must be a valid Solana
  address (base58, 32–44 characters); if it is not, the page stays in pre-launch
  rather than show something wrong. `/token` then leads with the address and a
  "Copy address" button, and the homepage shows a copy button beside the chart.
  No explorer link is shown.
- **Token channels** — `telegramUrl`, `discordUrl`. Only `https://` links are
  rendered. X is the project's one account (`SITE.links.x`); the token has no
  separate X link, and no launch time is shown.
- **Launch platform** — `launchPlatform.name` (currently `"pump.fun"`) is shown
  before launch as "Launching on pump.fun". `launchPlatform.url` is the token's
  own page there. For pump.fun it can stay empty: the coin's page follows from
  the mint (`pump.fun/coin/<mint>`) and is derived once the token is live. The
  "View on pump.fun" link, and the homepage chart's link to the same page, are
  only rendered when the token is live.
- **Disable the token page** — `enabled: false`. `/token` returns 404 and the
  homepage section, every nav/footer link, the sitemap entry and the token
  graphics disappear.

- **Activity chart** — nothing to configure. Once the token is live with a valid
  mint, `lib/token-activity.ts` reads the last 24 hours of its price from
  GeckoTerminal (most liquid pool, 15-minute intervals), on the server, cached
  for five minutes. The homepage shows it as a small sparkline with the 24-hour
  change under the hero's token line, and `/token` gets an "Activity" section
  with price, change, range, volume and a chart that can be read point by
  point. Under `npm run dev` the chart is always there, drawn from an example
  coin (`DEV_EXAMPLE_MINT` in `lib/token-activity.ts`) and labelled "example
  coin", so it can be seen before the token exists. A production build never
  shows the example: until the real mint is set and the status is `"live"`,
  the live site has no chart. Green means the window
  ended higher than it began, red lower, and the direction is always also given
  as a signed number. If GeckoTerminal has no pool for the mint yet, or cannot
  be reached, the chart is simply absent.

`/token` also carries the project's one statement about revenue ("Any money
the site makes, from advertising or anything else, will be put into the token."). The
risk disclosure is in `/terms#token`.

`lib/token.ts` turns the config into what pages may show (`getToken()`); pages
never read the config's addresses directly. `tests/unit/token.test.tsx` covers
both states of the page and fails if a non-pre-launch config has no valid mint.

To see the live state without real values:
`NEXT_PUBLIC_TOKEN_PREVIEW=live npm run dev`, then open `/` and `/token`. The
name, ticker and mint shown are invented, and the chart is still the example
coin's. Neither can reach a production build.

After changing token values run `npm test` and `npm run brand:export` (the launch
post with the mint is only generated once the token is live).

## Brand and social assets

Sources are in `brand-assets/`; `npm run brand:export` renders them with headless
Chromium and outlines the wordmark from the real font, so output is the same on
every machine. See `BRAND.md` for usage.

```
brand-assets/
  justresize-mark.svg, justresize-mark-mono.svg
  justresize-wordmark-dark.svg, justresize-wordmark-light.svg   (generated)
  templates/        HTML + CSS sources: avatar, X headers, share images, posts
  exports/          PNGs: avatars, X headers, OG images, post graphics, icons, favicon.ico
    x-headers/      alternative X headers to choose between (quiet-dark, quiet-cobalt,
                    quiet-paper, measure, squeeze, tiles), each at 1× and 2×
  social-copy.md    profile bio, launch post, feature posts, thread, token launch post
public/brand/       the subset the site serves (share images, manifest icons, SVGs)
  og/               one share image per tool page, from its heading and description
app/favicon.ico, app/icon.svg, app/apple-icon.png
```

The mark's geometry is duplicated in `components/brand/Mark.tsx`, `app/icon.svg`
and `scripts/brand/export.mjs`; change them together.

## Supported formats

| | Input | Output |
| --- | --- | --- |
| JPEG | yes | yes |
| PNG | yes (transparency detected) | yes |
| WebP | yes | yes — native encoder, or WASM where the browser has none (Safari) |
| AVIF | where the browser can decode it | yes — WASM encoder, downloaded on first use (slower than the others) |
| GIF | still images only | no (becomes PNG) |
| HEIC/HEIF | only where the browser decodes it natively (Safari) | no (becomes JPEG) |

Animated GIF/WebP/APNG are rejected with an explanation rather than silently
flattened to one frame. PDF, SVG, TIFF, BMP and video are rejected on arrival.
Files are identified by their bytes, not their extension.

## Architecture

```
app/                    Routes (see above). /app and the tool pages render the same shell.
components/             UI only. No component touches pixels.
  site/                 The public site: header, footer, homepage figures, flow lines, the hero's resize demo, long-form page layout
  token/                The token page, the address field (copy + explorer link), local launch time
  ui/                   Primitives: Button, Field (Select, Checkbox, PanelSection…),
                        NumberField, Segmented, Slider, Tooltip, Dim, icons
  brand/                The mark and the corner-bracket frame
  workspace/            App bar, layout, page-wide drop / paste, client-only loader
  uploader/ assets/     Empty state and Add bar; the file queue with per-image results
  preview/              The canvas: live preview, real result, zoom, crop positioning
  settings/             The inspector; every control reads and writes one TransformConfig
  jobs/                 The action bar: Resize / progress / Download and its state
lib/
  image/                THE ENGINE (no React, no stores)
    sniff.ts            bytes → real format, dimensions, animation, EXIF orientation
    decode.ts           File → upright pixels (all browser decode quirks live here)
    geometry.ts         pure math: output size, crop region, render plan, limits
    resize.ts           renderer: pixels + plan → canvas
    resample.ts         Lanczos3 + sharpen on raw RGBA (pure, streamed in bands)
    encode.ts           encoder registry; encoders/ holds the WASM and palette-PNG adapters
    quantize.ts         colour quantization: pixels → palette + indices (pure)
    png.ts              palette PNG writer (pure)
    target-file-size.ts optimizer: best encode at or under a byte target
    engine.ts           inspectImage / createPreview / processImage
  processing/           worker protocol, pool, queue, ingestion, previews, export
  files/                validation, naming, ZIP, download, folder drops
  settings/             defaults, Zod schema, live validation, URL presets
  presets/              built-in size presets (data) and the preset repository
  config/               safety limits, tuning constants, feature flags, site + token config
  tools/                tool pages as data: slug, copy, FAQ and the settings each opens with
  seo.ts, token.ts      page metadata + structured data; token config → what may be shown
scripts/brand/          the brand asset export
stores/                 Zustand: assets, processing jobs, settings, saved presets
workers/image.worker.ts Thin wrapper that runs engine requests off the main thread
tests/unit, tests/e2e
```

### Interface

Dark only, for now. Every colour, radius and control size is a token in
`app/globals.css` (`--surface-1`, `--text-secondary`, `--accent`, …) exposed to
Tailwind as `bg-surface-1`, `text-fg-secondary`, `border-line` and so on;
components never use raw palette values, so a light theme is one more block of
variables. Controls are 32 px with a mouse and 44 px on touch or narrow screens
— that switch is the `--control-h` / `--control-text` pair and the `touch:`
variant. Type is Archivo throughout, self-hosted by `next/font`. It is a
variable font with a width axis: display type is condensed (`.type-display`,
set by `--display-stretch`). There is no monospace face: measurements (`<Dim>`,
the `font-mono` class) are the same family with tabular figures.

Layout: a slim bar, the workspace (Add bar → canvas → file queue) and, from
1024 px up, the inspector docked to the right edge with the action bar at its
foot. Below that it is one column — canvas, settings, files — with the action
bar fixed to the bottom of the screen (above the iOS home indicator).

Before any image is open the workspace is only a centred place to add images;
the inspector and action bar appear with the first image. The page makes room
for them through two CSS variables, `--inspector-space` and `--dock-space`,
which are zero until `.inspector-dock` / `.action-dock` exist (`:has()` rules in
`globals.css`), so the server-rendered frame never needs to know.

The homepage (`app/page.tsx`) is built from the same tokens, at a larger scale.
Its hero is the headline pair (what the tool does, then one dimmer line on the
token's status), one sentence, the two ways in, and the workspace figure, which
runs off the right edge on wide screens. These parts are worth knowing:

- `components/site/Flow.tsx` — nodes joined by thin directional lines. The same
  component draws the batch strip and the local-processing diagram.
- `components/site/ResizeDemo.tsx` — the one client component with a timer. It
  steps the workspace figure's picture through four output sizes and keeps the
  dimension lines and the fields in step. It only runs
  while on screen, stops for good when the visitor picks a size, and never
  starts under `prefers-reduced-motion`. `WorkspaceFigure` must be rendered
  inside it.
- `components/site/Reveal.tsx` — plays a figure once, the first time it is
  scrolled to. It sets `data-inview`; the animations are CSS in `globals.css`
  ("Motion on the public site"): parts with `reveal` settle in, in the order
  given by `--i`; `reveal-size` shrinks a bar to its size, slowly, and
  `<CountBytes>` counts its number down on the same curve. The server renders
  everything in its finished state, so the page is whole without scripts and
  under reduced motion. The hero's own entrance (`.hero-in`: each part fades
  in and rises) is CSS only.
- `lib/site/samples.ts` and `public/samples/` — the four example photographs
  (Unsplash; credits in `public/samples/credits.txt`). The hero demo shows the
  next one with each output size, and the batch figure lists them as files.
- `components/site/MobileMenu.tsx` — the phone navigation, a native modal
  `<dialog>`. `components/site/Questions.tsx` — the homepage questions: a plain
  list on wide screens, accordions on a phone, the same markup for both.
- `.paper` in `globals.css` — the one light band ("Need it under 500 KB?"). It
  redefines the colour tokens for its subtree, so the components inside still
  use the semantic classes.

Images dropped on the homepage are handed to the workspace in memory
(`lib/files/handoff.ts`) across a client-side navigation. Nothing is stored or
serialised; if the hand-off ever fails the visitor lands in the empty tool.

The action bar's main button follows the work. `lib/settings/compare.ts` tells
whether a finished result was made with the settings now on screen: if every
image has one, Download leads and "Resize again" steps back; change a setting
and Resize leads again, with "Results use previous settings." and the old
results still available as "Download existing ZIP". The canvas uses the same
check to show the real output file in place of its simulation. `O` and `R`
switch the canvas between the original and the result.

### Processing pipeline

```
File → sniff → decode → geometry → render → encode ─┐
                                          ▲         ▼
                                          └─ optimizer (file-size targets)
```

1. **Sniff** – read the header: actual format, dimensions, animation, EXIF
   orientation. Oversized images are rejected here, before any decode.
2. **Decode** – `createImageBitmap`, falling back to an `<img>` element. EXIF
   rotation is baked into pixels; whether the browser does that itself is
   detected with a generated probe image, not user-agent sniffing.
3. **Geometry** – `computeRenderPlan(source, config)` returns the output size,
   the source region to sample and where it lands. Pure and unit-tested. The
   live preview calls the same function, so preview and export cannot disagree.
4. **Render** – puts the plan's pixels on a canvas. An export that shrinks the
   image is resampled with our own Lanczos3 filter (`resample.ts`) and then
   sharpened lightly, because browser canvas scaling is softer and differs from
   browser to browser; the result is byte-identical everywhere. Pixels are
   streamed in bands, so memory stays bounded for very large images. Thumbnails,
   previews and enlargements use canvas scaling (halved in stages past 2×),
   where speed matters more. Strength and thresholds are in `RESIZE_TUNING`.
5. **Encode** – through the `ImageEncoder` interface. Native canvas encoding
   where the browser supports the format, otherwise a lazily loaded WASM codec.
   The result's MIME type is verified: a browser that silently falls back to PNG
   is treated as a failure, never passed off as the requested format.
6. **Optimize** (only with a file-size target) – see below.

Every run starts from the original `File`; outputs are never re-processed, so
repeated runs do not accumulate quality loss. Output is re-encoded from pixels and
therefore carries no metadata (EXIF, GPS, ICC).

### File-size targets

`lib/image/target-file-size.ts`, driven by an injected
`encode(scale, quality, colors)` function so it is tested without a browser.

- **Smart** (default): binary-search quality for the highest value that fits. If
  quality would have to drop below 0.6, shrink dimensions instead
  (`scale ≈ sqrt(target / size) × 0.95`) and search again.
- **Compress only**: quality search down to 0.3, dimensions untouched.
- **Resize only**: fixed quality, dimensions shrink, then bisect back up.
- **PNG** has no quality setting, so colours play that role. Without a
  file-size target a PNG is always lossless. With one, the lossless file is
  tried first; if it is too big the image is reduced to a palette of at most
  256 colours and written as an indexed PNG (`quantize.ts`, `png.ts` — the
  pngquant/TinyPNG approach), searching for the largest palette that fits.
  Dimensions, and therefore text sharpness, are untouched. Smart goes down to
  32 colours before it shrinks dimensions; Compress only goes to 8 and never
  shrinks; Resize only keeps every colour and shrinks instead. An image that
  already has few enough colours stays lossless. The result line says how many
  colours were kept.

The result is always **at or under** the target, never "close". Every loop is
bounded, identical attempts are cached, and an unreachable target ends in a clear
message with suggestions. Tuning constants are in `lib/config/limits.ts`.

Sizes use binary units with everyday labels: 1 KB = 1024 bytes, 1 MB = 1024 KB.

### Workers and the queue

- `EnginePool` schedules requests over at most `min(4, cores / 2)` workers.
  Concurrency is a weight budget: sources over 40 MP take two slots.
- Ingestion (validate, measure, thumbnail) and previews go through the same pool
  at high priority, so dropping 300 photos never decodes 300 images at once.
- Each job gets a `structuredClone` of the settings when queued. Changing
  settings mid-batch only affects later runs.
- Cancelling aborts cooperatively; a worker that has not acknowledged within
  1.5 s is terminated and replaced.
- One failing image never stops the batch. A memory failure halves concurrency
  for the rest of the session (4 → 2 → 1).
- Without module workers or `OffscreenCanvas`, the same engine runs on the main
  thread ("compatibility processing") and the UI says so.

### Memory protections

- Limits (`lib/config/limits.ts`): 32,767 px per side and 120 MP per source,
  100 MP per output. There is deliberately no cap on a file's size in bytes or
  on the number of images in a session (the site says "Unlimited images. No
  file size limit."); memory is spent on decoded pixels, which is what the
  pixel limits bound. Very large batches are limited by the device: the list
  is not virtualized and the ZIP is assembled in memory.
- Canvases above 16 MP are probed after allocation, because browsers (notably
  iOS Safari) fail silently past their limit and would export a blank image.
- `ImageBitmap.close()`, canvas release and `URL.revokeObjectURL()` are called
  explicitly. Result Blobs live outside React; stores hold metadata only.
- The list shows small generated thumbnails, never originals. Only the selected
  image has a preview bitmap (≤ 1600 px, LRU of 3).

### State

One `TransformConfig` (`types/index.ts`) describes a whole transformation and is
plain serializable data, validated with Zod wherever it enters from outside
(localStorage, saved presets, URL). Settings and presets persist locally; images
never do — a reload always starts with an empty list.

## Extending

**Add a size preset** – append to `SIZE_PRESETS` in `lib/presets/defaults.ts`.

**Add a codec** – write an adapter implementing `ImageEncoder` in
`lib/image/encoders/`, return it from `loadEncoder` in `lib/image/encode.ts`
through a dynamic `import()`, and add the format to `OUTPUT_FORMATS` in
`lib/image/formats.ts`.

**Add a tool page** – add an entry to `lib/tools/definitions.ts` (slug, title,
copy, FAQ, and the settings it opens with), then run `npm run brand:export` to
make its share image (`public/brand/og/<slug>.png`; a unit test fails without
it). The route, sitemap entry, footer link and structured data follow. Only add one when it changes what the tool
does on arrival; a unit test fails if two pages open with the same settings.

**URL presets** – `/app?width=1200&height=630&format=webp`, also `max=1600`,
`percent=50`, `target=500kb`, `strategy`, `fit`, `quality`. Invalid values are ignored.

**Feature flags** – `lib/config/features.ts`.

**Analytics** – none is wired up. `lib/analytics.ts` is a seam with a
deliberately narrow event type (`tool_opened`, `files_added`, `resize_started`,
`resize_completed`, `zip_downloaded`, `processing_failed`, `token_page_viewed`):
counts and categories only, with no way to pass a file name, image data or an
address. Plugging in a provider also means updating the CSP and `/privacy`.

**Future paid features** (Pro, saved recipes, larger batches, team presets, an
API) are not built and nothing claims they are. The seams they would use exist:
`PresetRepository` for cloud presets, `FEATURES` for gating, and limits in
`lib/config/limits.ts`. Advertising is Auto ads only (see "Deploying"); the rule
for it is: never near download controls, never before a download.

## Dependency decisions

| Package | Why |
| --- | --- |
| `zustand` | Small store with selector subscriptions; job updates re-render only the affected row |
| `zod` (`zod/mini`) | Validation of stored and URL data. The mini build cut ~330 KB from the app bundle |
| `fflate` | Streaming ZIP writer (store mode — images are already compressed), and the deflate step of the palette PNG writer |
| `@jsquash/webp`, `@jsquash/avif` | Maintained WASM builds of libwebp and libavif (from Squoosh). Loaded only when needed |

The AVIF adapter imports jSquash's single-threaded codec directly. The package's
default entry also references a threaded build whose worker imports the module
that spawns it; that cycle hangs Turbopack's production build, and the threaded
build needs cross-origin isolation headers this site does not send.

No UI kit, icon pack, animation library, chart library, canvas library,
server-side image library or blockchain library is used. `/token` shows
addresses as text with explorer links, and its chart is an SVG path computed in
`lib/token-chart.ts`; neither needs a Solana SDK.

Dev-only: `@fontsource-variable/archivo`, `@fontsource/archivo` and
`opentype.js` are used by `npm run brand:export` and never reach the site bundle.

## Tests

- **Unit (241 tests)** – geometry and fit math, crop regions, staged downscaling, the
  Lanczos resampler, colour quantization and the palette PNG writer, safety
  limits, filename formatting and collisions, byte formatting, the file-size
  optimizer (including termination against constant and erratic encoders),
  header sniffing, EXIF, the pool scheduler, schema and URL parsing — plus the
  token rules (address validation, pre-launch never shows an address, a "live"
  config without a real mint falls back, the rendered page in both states, the
  committed config's coherence) and the site data (tool pages are distinct and
  valid, the sitemap is complete).
- **End to end (70 scenarios, 99 runs across browser projects)** – run against the production build. Fixtures are
  generated in the browser, not committed. They download the real output and
  check its bytes and pixels: dimensions, format signatures, transparency,
  rotation, crop position, ZIP contents, file-size ceilings, cancellation, a
  50-image batch, and that processing makes no network requests. The site spec
  covers the homepage (one click to the tool, the drop hand-off, the hero's size
  demo, the launch banner, a token section with no address, figure or link to a
  trading venue before launch, no sideways scroll on a phone), every tool
  page, the pre-launch token page, metadata on every route, sitemap / robots /
  manifest, the security headers, and that the CSP blocks nothing the engine
  needs. Core flows also run in WebKit, Firefox and a phone viewport.

## Known limitations

- **Not verified on real devices.** WebKit and a phone-sized Chromium are
  covered by automation; real iOS Safari, Android Chrome and Edge are not.
- **Legal pages are drafts.** `/privacy`, `/terms` and the token disclosures
  were written to match what the code does, not reviewed by a lawyer. They show
  no operator, governing law or contact until those are set in
  `lib/config/site.ts`.
- **The token's live page has not run in production.** It is covered by unit
  tests and the development preview; the first real check is after a real mint
  is configured.
- **The CSP allows inline scripts and styles** (`'unsafe-inline'`), which
  Next.js's prerendered pages need. Tightening it means nonces and giving up
  static prerendering.
- **Colour** – output is sRGB. Wide-gamut photos (e.g. Display P3 from phones)
  are converted, and ICC profiles are not written.
- **Metadata** is always stripped. `metadata.preserve` exists in the config
  model but is not implemented or exposed.
- **HEIC** only works where the browser decodes it (Safari). There is no
  bundled decoder yet.
- **Palette PNGs** are only produced under a file-size target; there is no
  standalone "reduce colours" control. Photos stored as PNG show the reduction
  (they are dithered, like a GIF) — WebP or JPEG is the better output for those.
  Each attempt quantizes and deflates in JavaScript: a few seconds in total for
  a 5 MP screenshot.
- **AVIF encoding is slow** (single-threaded WASM); a file-size target
  multiplies that by the number of attempts.
- **Resampling** runs in JavaScript: roughly 0.3–0.5 s for a 24 MP photo on a
  laptop. Sharpening is automatic on reductions and has no user control
  (`RESIZE_TUNING.sharpenAmount`; 0 turns it off). Filtering is done in sRGB
  space, not linear light.
- **ZIP** archives are assembled in memory, so very large batches are bounded by
  available RAM.
- **Transparency detection** samples the thumbnail, so a handful of isolated
  semi-transparent pixels in a large image can be missed (it only affects which
  hints are shown, not the output).
- **Multiple outputs**: while output variants are defined, the preview still
  reflects the settings panel, not each variant.
- A worker killed outright by the OS for memory, without raising an error,
  leaves its job in "processing" until cancelled.

## Status

As of 2026-10-01 the engine, the tool's interface, the public site, the token
page (pre-launch) and the brand assets are complete: lint, typecheck, unit
tests, the production build and the end-to-end suite all pass.

Not yet done:

- No git repository has been initialised.
- Not deployed. `vercel` from the project root is all it should take.
- Not run on real iOS or Android devices, or in Edge.
- No light theme. The tokens are ready for one (see Interface above).
- Launch values are empty: official X URL, contact email, operator and
  jurisdiction, and every token value except the launch platform's name
  (pump.fun). See `TOKEN-LAUNCH-CHECKLIST.md`.

## Roadmap

Built: everything in P0, plus clipboard paste, saved presets, remembered
settings, multiple outputs, AVIF output, focal-point and drag cropping, filename
patterns, folder drops, URL presets.

Not built: bundled HEIC decoder, per-variant preview, metadata preservation,
offline use (there is a web manifest, but no service worker), list
virtualization beyond `content-visibility`, URL import, animated GIF, SVG, PDF
and video tools, accounts, cloud presets, API, a changelog page, a light theme.

Working notes for contributors and AI sessions (gotchas, codebase rules) are in
`CLAUDE.md`.
