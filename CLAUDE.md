@AGENTS.md

# JustResize — working notes

Browser-only image resizer/compressor/converter (justresize.com). Next.js 16 App
Router, TypeScript, Tailwind v4, Zustand. No backend: images never leave the device.
`README.md` has the full architecture, routes, pipeline, limits, configuration and
extension guides — read it before changing the engine. `BRAND.md` covers identity
and voice; `TOKEN-LAUNCH-CHECKLIST.md` covers what must be true before the token
goes live.

Three parts, in order of importance: the **tool** (`/app` + tool pages), the
**public site** (`/`, `/about`, `/privacy`, `/terms`, 404), and the **token
information page** (`/token`), which is config-driven text and links only.

## Where things stand (2026-10-02)

- Engine, tool UI, public site, pre-launch token page, brand assets and docs are
  complete and verified: lint, typecheck, 241 unit tests, production build, and
  the e2e suite (109 runs: Chromium, with core flows also in WebKit, Firefox and a
  phone viewport).
- The homepage, top to bottom: headline pair ("Private compression tool." /
  "Token launching on Solana.", the second line from the token's status) with
  the token's small activity chart under it, one sentence, two buttons, the
  animated resize demo in the workspace figure, one light band (`.paper`,
  "Need it under 500 KB?"), "Unlimited images. No file size limit.", the
  local-processing section, "JustResize × Solana", and "Questions" last (also
  the page's FAQ structured data; accordions on a phone). The launch banner is
  on (`SITE.launchBanner`).
- **Type is Archivo, one family** (owner's calls, 2026-10-02: IBM Plex was "too
  common", then the mono face's slashed zero was "too techy"). It is a variable
  font with a width axis: display type is condensed (`.type-display`,
  `--display-stretch`). There is no monospace face. The `font-mono` class is
  still what measurements carry, and now means "same family, tabular figures".
- **Motion** (owner asked for more, then tuned it, 2026-10-02): the hero fades
  in and up in order (no width or letter-spacing animation: the owner disliked
  the headline being compressed); figures play once when scrolled to
  (`components/site/Reveal.tsx`), with the 500 KB bar and its number gliding
  down slowly together; the local-flow line and live-data markers loop slowly.
  All of it is CSS in `app/globals.css` under "Motion on the public site".
  `/app` has none.
- **Example pictures are real photographs** (owner asked, 2026-10-02): four
  Unsplash photos in `public/samples/` (credits in `credits.txt` there), listed
  in `lib/site/samples.ts`. The hero demo shows the next one with each output
  size; the batch figure uses their thumbnails.
- **No cap on file size or image count** (2026-10-02): the owner wanted the
  homepage to say "Unlimited images. No file size limit.", so `maxFileBytes`
  and `maxBatchFiles` in `lib/config/limits.ts` are now infinite to make that
  true. The pixel limits (120 MP per source, 100 MP per output) remain and are
  what protect memory. If a cap comes back, the copy must change with it.
- **Share images**: the site's (`justresize-og.png`, "Private compression
  tool."), the token's, and one per tool page (`public/brand/og/`). X links
  carry the X logo (`XLogo` in `components/ui/icons.tsx`).
- **Ultrawide screens** (2000 px and up): the hero's workspace figure stops
  running to the window edge and takes a fixed width with its right side
  closed (`min-[125rem]:` in `app/page.tsx` and `WorkspaceFigure.tsx`; change
  the three together). Below that it docks to the edge as before.
- **Phone navigation is a menu** (`components/site/MobileMenu.tsx`, a native
  modal `<dialog>`); from 640 px up the links are in the header.
- **Google AdSense is wired in** (`SITE.adsenseClient`, `lib/ads.ts`). The script
  loads in production builds only, `/ads.txt` is generated from the same ID, the
  CSP gains Google's ad origins (`lib/config/csp.ts`) and `/privacy` has an
  advertising section. Only the loader is installed: where ads appear is set in
  the AdSense console (Auto ads). No ad units are placed in the markup.
- **Token activity chart** (owner asked, 2026-10-02): a small sparkline with
  the 24-hour change sits under the hero's token line and `/token` gets an
  "Activity" section. Data is GeckoTerminal's public API, fetched by the server
  and cached 5 minutes (`lib/token-activity.ts`), so the browser never contacts
  it. The small chart opens the coin's pump.fun page in a new tab, with a
  button beside it that copies the token address. **On the live site it
  appears only once the token is live with a real mint.** Under `npm run dev` it is always shown, drawn from an example coin
  the owner supplied (`DEV_EXAMPLE_MINT`) and labelled "example coin". Never
  make the example show in a production build: it would present someone
  else's coin as this project's.
- **Not done:** no git repo yet, not deployed to Vercel, never run on a real
  iOS/Android device or Edge. Dark theme only. Legal pages are unreviewed drafts.
  Ads have only been checked on localhost, where Google serves none.
- **Launch values are mostly empty** in `lib/config/site.ts`: contact email,
  operator, jurisdiction, Search Console verification, and every token value
  (`status: "prelaunch"`) except `launchPlatform.name` ("pump.fun") and `ticker`
  ("SIZE", which the owner said they "think" they will use, 2026-10-02: treat it
  as provisional). The X account is set (`https://x.com/justresize`, from the owner). Empty values are never rendered. Don't fill any of them with guesses.
- **`/token` leads with the token address and a "Copy address" button** (owner
  asked, 2026-10-02): no "Verify the mint" button, no Solscan link, no
  separate mint row. The pump.fun link is derived from the mint
  (`pumpFunUrl`), so `launchPlatform.url` can stay empty. The live banner's
  link reads "View now".
- **Revenue wording** (owner's decision, 2026-10-02, reversing the removal of
  2026-10-01): `/token` says "Any money the site makes, from advertising or
  anything else, will be put into the token." and the Risks section was removed
  from that page
  (the disclosure is still in `/terms#token`). That sentence is the whole of it:
  no mechanism, percentage, amount, comparison with other sites or statement
  about the token's price has been written, and none should be added unprompted.
  No treasury or allocation content, no "Not published yet" rows.
- The design direction is the owner's: a calm desktop-grade utility — few borders,
  no cards inside cards, one cobalt accent, one typeface. The homepage is
  the one loud place (big condensed type, contrast between sections, motion,
  real photographs);
  `/app` stays calm. Don't restyle unprompted; change the look through the tokens
  in `app/globals.css` and the primitives in `components/ui/`. The README's
  "Interface" section explains the system.

## Likely next steps

1. `git init` and first commit (only when asked).
2. Deploy to Vercel (`vercel`; no env vars, no config needed) and check on the
   deployed URL that the worker and WASM load and the console has no CSP errors.
3. Owner fills in launch values (see the checklist) and gets legal review, which
   now includes the advertising-revenue sentence on `/token`. In the AdSense
   console: add the site, turn on the consent message for the EEA/UK/Switzerland,
   and keep Auto ads off `/app` and the tool pages' download controls.
4. Real-device checks: iOS Safari (canvas size limits, HEIC, sticky action bar,
   safe area), Android Chrome, Edge.
5. Unbuilt items, in rough priority: bundled HEIC decoder (`FEATURES.heicWasm`),
   per-variant preview for multiple outputs, list virtualization for very large
   batches, service worker/offline, light theme. Full list at the bottom of the README.

## Commands

```bash
npm run dev          # localhost:3000
npm run lint && npm run typecheck && npm test
npm run build
npm run test:e2e     # builds, serves on :3100, runs all browser projects
npm run brand:export # regenerates brand-assets/exports, public/brand, favicon, apple icon
NEXT_PUBLIC_TOKEN_PREVIEW=live npm run dev   # the token as live, with invented values (dev only; the chart shows in dev either way)
NEXT_PUBLIC_ADS=off npm run build            # a production build without the ad script (what the e2e suite builds)
```

## Things that will bite you

- **Stale e2e server.** Playwright reuses whatever is already listening on :3100.
  After changing app code, run `pkill -f "next start"` before `npm run test:e2e`,
  or the tests run against the old build.
- **The settings only exist once an image is open.** With no images the workspace
  is just the drop area: no inspector, no `process-button`. E2E tests that are
  about settings call `addAnyImage(page)` first (`tests/e2e/helpers.ts`).
- **The tool lives at `/app`, not `/`.** `openApp(page)` defaults to it. URL
  presets are `/app?width=…`.
- **Content-Security-Policy** is built in `lib/config/csp.ts` and sent from
  `next.config.ts`. Without ads it is `connect-src 'self'`; with ads it adds
  Google's ad origins and nothing else. Any other external script, font, image
  host or fetch target is blocked until it is added there — and `/privacy` lists
  what is loaded, so update that too.
- **The e2e suite builds without ads** (`NEXT_PUBLIC_ADS=off` in
  `playwright.config.ts`), so it never calls Google. The ad-carrying policy is
  covered by unit tests. To look at a build with ads: `npm run build && npm start`.
- **Token activity is server-side only.** `lib/token-activity.ts` fetches and
  holds the development example mint; `lib/token-chart.ts` is the pure half
  that client components may import. Don't import the former from a
  `"use client"` file, and never put the example mint in `TOKEN_CONFIG` (a unit
  test checks).
  The homepage must not show a dollar figure: the hero gets the sparkline and
  the percentage, `/token` gets the price.
- **Things inside `<Reveal>` are invisible until scrolled to** (`.reveal`,
  `.reveal-size`, where scripts run). E2E tests that read them scroll first.
  Full-page Playwright screenshots restart CSS animations; that is the
  screenshot, not a bug.
- **Don't export plain values from a `"use client"` file to a server component.**
  On the server they are client references, not the value (`X.toLowerCase is not
  a function` at prerender). Shared constants go in `lib/`.
- **`font-mono` is not a monospace font.** It is the measurement style: the
  same family with tabular figures. Don't bring a mono face back (the owner
  rejected two), and don't rely on characters being equal width.
- **Token rules.** Pages read the token only through `getToken()` (`lib/token.ts`),
  never `TOKEN_CONFIG` addresses directly. Never write an address, ticker or
  placeholder into JSX, a template or a test fixture that could ship; the unit
  tests use obviously fake values. No wallet/price/swap code, no Solana SDK.
- **Never import `@jsquash/avif/encode`.** It references a threaded build whose
  worker imports its own parent; Turbopack's production build hangs forever with no
  error. `lib/image/encoders/wasm-avif.ts` imports the single-threaded codec directly.
- **Geometry functions must return plain `{ width, height }`.** They are handed rich
  objects (decoded bitmaps, assets). Spreading one leaks an ImageBitmap into a value
  that later crosses `postMessage` and fails with a DataCloneError. Use `sizeOf()`.
- **Use `zod/mini`, not `zod`.** `import { z } from "zod"` pulls every locale and
  adds ~330 KB to the bundle.
- **Next.js 16 differs from older versions.** Check `node_modules/next/dist/docs/`
  before using an API from memory (see AGENTS.md).
- **Segmented controls are visually hidden radios.** In e2e tests click the segment's
  text (`getByText("Max size", { exact: true })`); `getByLabel(...).check()` times out
  because the label covers the input. `toBeChecked()` on the label works.
- **Components use semantic classes only** (`bg-surface-1`, `text-fg-secondary`,
  `border-line`, `h-(--control-h)`, the `touch:` variant). A raw colour or a fixed
  control height in a component is a bug.
- **`WorkspaceFigure` only works inside `<ResizeDemo>`.** Its numbers come from
  that client context (`components/site/ResizeDemo.tsx`); outside it, it throws.
  E2E tests that read the demo's numbers emulate reduced motion first, so the
  size does not change under them.
- **`.paper` redefines the colour tokens for its subtree.** Inside the light band
  keep using `text-fg`, `border-line` and so on; a raw dark colour there is the bug.
- **Debugging a production build:** `localStorage.setItem("justresize:debug", "1")`
  and reload to get the real error detail in the console and the timing panel.
  User-facing errors are intentionally vague; the detail only shows in debug mode.

## Rules of the codebase

- Components never touch pixels. Image work goes in `lib/image/` (no React, no
  stores) and is reached through the worker pool in `lib/processing/`.
- All transform settings live in the one `TransformConfig`. A new setting needs:
  the type (`types/index.ts`), a default (`lib/settings/defaults.ts`), the Zod
  schema (`lib/settings/schema.ts`), and live validation if it can be invalid.
- The preview and the export both call `computeRenderPlan`. Keep it that way so
  they cannot disagree.
- Every exposed control must really work, and every output must be verified
  (format, size, target) before a job is marked complete. No faked progress.
- Format support is a runtime capability, not an assumption — see
  `lib/image/formats.ts` and `lib/image/capabilities.ts`.
- E2E tests locate things by label/role first, then `data-testid`
  (`file-input`, `asset-row`, `job`, `process-button`, `download-all`,
  `output-summary`, `batch-summary`, `process-reason`, `progress-text`,
  `preview-canvas`, `token-status`, `token-address`). Renaming a label or test id
  means updating `tests/e2e/`.
- Site facts (URLs, email, token values) live only in `lib/config/site.ts`, and an
  empty value must render nothing. Page metadata goes through `pageMetadata()` in
  `lib/seo.ts`; titles must be unique (an e2e test checks).
- A tool page (`lib/tools/definitions.ts`) must open with different settings from
  every other one, and its copy must be true of the engine. After adding or
  renaming one, run `npm run brand:export`: it makes the page's share image
  (`public/brand/og/<slug>.png`), and a unit test fails if it is missing.
- Copy follows `BRAND.md`: say what it does; no hype; nothing about the token on
  the tool's own screens beyond the small header link.
- E2E fixtures are generated in the browser by `tests/e2e/helpers.ts`; don't commit
  binary images.

## Scope guard

The product rule from the original brief: every feature must help someone take an
image they have and quickly make it the size they need. No accounts, database,
payments, AI features or server-side processing unless explicitly requested.

Product first, crypto second. The tool must never require a wallet, a token, an
account or a payment. The token page is information only: no wallet connection,
swaps, holder counts or "buy" buttons. By the owner's decision it carries a
read-only chart of the token's recent price once the token is live, and one
sentence saying the money the site makes is put into the token. Beyond that
sentence the site makes no claim about revenue, value or returns: no figure, no
comparison, no mechanism, percentage, address or amount is ever invented, and
nothing says or implies the price will rise. A value that does not exist is
simply absent, and the launch platform is linked only once live.
