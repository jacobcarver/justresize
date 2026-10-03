# JustResize brand

One page. If something here and the product disagree, fix whichever is wrong.

## What JustResize is for

Take an image you have and quickly make it the size you need, without sending it
anywhere. Everything the brand does should make that feel fast, exact and safe.

## Traits

Dark, precise, professional, technical, minimal, fast. A desktop-grade utility,
not a SaaS dashboard and not a crypto site.

## The mark

Two opposing corners of a frame on a cobalt tile: the top-left and bottom-right
handles you would drag to resize something.

| File | Use |
| --- | --- |
| `brand-assets/justresize-mark.svg` | The mark. Favicons, app icons, anywhere small. |
| `brand-assets/justresize-mark-mono.svg` | One colour, no tile. Only where the cobalt tile cannot be used (stamps, single-colour print). |
| `brand-assets/justresize-wordmark-dark.svg` | Mark + name, light text, for dark backgrounds. |
| `brand-assets/justresize-wordmark-light.svg` | Mark + name, dark text, for light backgrounds. |

Geometry (32-unit grid): tile radius 7; corners drawn with a 3-unit round stroke,
each arm 6 units, framing a 14-unit square in the centre. The same path lives in
`components/brand/Mark.tsx`, `app/icon.svg` and `scripts/brand/export.mjs` —
change all of them together, then run `npm run brand:export`.

Rules:

- Clear space: half the tile's width on every side.
- Minimum size: 16 px. It is drawn to survive that.
- The tile is always cobalt `#3563e9`, the corners always white.
- Don't rotate it, outline it, add a gradient or shadow, put it in a circle (the
  token avatar is the one exception, below), or redraw the corners as arrows.
- No photograph, mountain or generic crop icon ever stands in for it.

## The name

Always **JustResize**: one word, two capitals. Never "JUSTRESIZE", "Just Resize"
or "justresize" (the last only in the domain, `justresize.com`).

The wordmark is Archivo SemiBold at its normal width, letter-spacing −0.01em,
cap height centred on the tile. The SVG files contain outlines, so they need no font.

## Colour

Defined once, as tokens, in `app/globals.css` (and mirrored for the social
templates in `brand-assets/templates/brand.css`).

| Role | Value | Notes |
| --- | --- | --- |
| Background | `#0e0f11` | Deep neutral graphite |
| Surfaces | `#15161a` `#1d1e23` `#282a30` | Three steps up |
| Canvas | `#0a0a0c` | The well an image sits in |
| Text | `#ececef` / `#a6a7b1` / `#8a8b96` | Primary / secondary / tertiary |
| Cobalt (accent) | `#3563e9` | The one accent. Fills and the mark |
| Cobalt, as text | `#8aa6ff` | Same hue, legible on dark |
| Green | `#4cc38a` | Only "local processing" and "done" |
| Amber / red | `#e0a63d` / `#f47670` | Warnings / errors |
| Paper | `#e9e4d7` | One band on the homepage only (`.paper`). The sand of the sample image, with near-black text and a darker cobalt `#2447c4` |

- One accent. No purple, no gradients, no glow.
- Green means "done" (a check mark) and the "Local processing" shield in the tool's bar. Its one other use is the token
  activity chart, where the line is green when the last 24 hours ended higher
  and red (`#f47670`) when lower. The direction is always also given as a signed
  number, so the colour never carries it alone. Green is not used for any other
  financial thing: not the "live" status, not a button, not a headline.
- The only other colour on the site is inside pictures: the four example
  photographs used in the figures (`public/samples/`; mountains, water, a dune
  at night, blossom). They are real photographs from Unsplash, credited in
  `public/samples/credits.txt`. Add to them from the same kind of source:
  nature or abstract, no people, no brands, cool tones with one warm one.

## Type

- **Archivo** for everything, and nothing else. It is a variable font with a
  width axis, and the width is used: text is set at the normal width, display
  type (the homepage's big lines and every page title) is condensed to 78%
  (`--display-stretch`). A tool that compresses files sets its headlines
  compressed.
- **No monospace face.** Measurements (dimensions, file sizes, counts,
  addresses) are set in Archivo with tabular figures, so numbers line up and
  hold still as they change. Clean and plain: no slashed or dotted zeros. On
  the homepage a measurement may be the biggest thing on screen (`487 KB`).
- Three sizes carry the homepage: display (the hero and the sections meant to
  stop the scroll), headline, and body. Labels stay small and in sentence case.
- Headlines: SemiBold, condensed, tracking −0.02 to −0.025em, sentence case,
  full stop if it is a sentence.
- No all-caps labels, no tracked-out eyebrows.

## The measurement motif

The one signature device, used with restraint:

- **Dimension lines** — tick, line, value, line, tick — along the top and left of
  an image (`components/ui/DimensionLines.tsx`). Thin and low contrast, and they
  always show a true number.
- **The dimension equation** — `4032 × 3024 → 1600 × 1200` — in tabular figures, with the
  result brighter than the source. Use `×`, not `x`.
- **Corner brackets** frame the places that ask for images (the empty workspace,
  the drop target) and the 404.

- **The flow line** — node, hairline, arrowhead, node
  (`components/site/Flow.tsx`). It shows something going from one state to
  another: a batch to a ZIP, an image through your browser to a new file. The
  node that matters is cobalt (the browser, where the work happens; or where
  the flow ends up). No node is green.

Don't stack them, don't use them as decoration where nothing is being measured,
and don't let them look like CAD.

Example numbers used across the site and social assets, so they stay consistent:
`4032 × 3024 → 1600 × 1200`, `5.8 MB → 482 KB`, `5.3 MB → 500 KB limit → 487 KB`,
`84 images`, `412 MB → 31 MB`. The homepage's batch section is headed
"Unlimited images. No file size limit."; the 84-image batch is the example
under it.

## Layout and shape

- Few borders. Hairlines (`--border-subtle`) separate; boxes are rare.
- No cards inside cards. No bento grids. No floating 3D screenshots.
- Radius: 6 px on controls, 10 px on panels. Nothing rounder.
- Product pictures are the real interface, drawn from the real components
  (`components/site/WorkspaceFigure.tsx`), never an invented dashboard.
- Icons: one inline set (`components/ui/icons.tsx`), 24-unit grid, 1.75 stroke,
  round caps. No icon packs.
- The homepage is the one place that is allowed to be loud, and it gets there
  with scale and contrast between sections, not decoration: one very large
  thing per section, one light band, and the workspace figure running off the
  right edge the way the app docks its inspector there.
- Motion shows something changing size or arriving, and nothing else moves.
  On the public site: the hero arrives once, in order, each part fading in and
  rising a little (type is never stretched or re-spaced as an effect); the
  example picture changes size slowly between four outputs until the visitor
  picks one; each figure plays once when it is scrolled to (the bar glides
  slowly down to its file size with its number, the batch rows complete in
  turn); the local-flow
  line and the marker on live token data loop slowly. Nothing loops quickly,
  nothing moves for decoration, and reduced motion shows every finished state
  at once. Inside the tool (`/app`), motion still only answers an action.

## Voice

Direct, confident, technical without being nerdy, slightly playful, never
corporate, never hype.

| Say | Don't say |
| --- | --- |
| Resize it. | Revolutionize your content workflow. |
| Under 500 KB. | Unlock the power of next-generation image optimization. |
| Processed locally. | Experience Web3-powered resizing. |
| 84 images ready. | Blazing-fast AI-driven compression. |

- Say what the thing does. Name controls by what the user is doing.
- Dimensional jokes are allowed once in a while (`404 × 404`). Not on every line.
- Never claim something the code doesn't do. If a format, limit or behaviour is
  mentioned, it must be true in `lib/image/`.
- The homepage headline is a pair: "Private compression tool." and, dimmer, one
  line on the token's status ("Token launching on Solana."). The first line
  always says what the tool does.

## The token: same brand, stricter rules

The token is part of the JustResize project, so it looks like JustResize. It
does not get its own identity.

Visual:

- Same mark, same cobalt, same type, same dark field.
- **Token avatar**: the mark's corners on a cobalt disc on the dark field
  (`brand-assets/exports/justresize-token-avatar-1024.png`). That disc is the
  only difference from the product avatar.
- "Solana" is written as a word. Solana's logo and brand colours are not used
  (they are someone else's trademark; see `TOKEN-LAUNCH-CHECKLIST.md`).
- Never: rockets, moons, laser eyes, gold coins, candlesticks, bulls, purple/green
  gradients, scrolling price tickers, countdowns.
- The one chart is the activity line: a thin 24-hour price line, small in the
  homepage hero and readable on `/token`, drawn only from real data for the
  live mint. It is never mocked up, and never appears in a social graphic.

Words:

- Factual and checkable. "Official JustResize token information."
- Never: invest, guaranteed, profit, moon, 100x, passive income, floor, buy
  pressure, "number goes up", "don't fade", "send it".
- Never say resizing is on-chain, decentralised or blockchain-powered. It isn't.
- Never imply ownership of JustResize or a holder's right to a share of revenue.
- The site says one thing about revenue, on `/token`: "Any money the site
  makes, from advertising or anything else, will be put into the token." Nothing
  is added to it: no
  revenue figures or comparisons with other sites, no mechanism that has not
  been decided, and nothing that says or implies the price will rise. Never:
  "pumps", "buybacks", "price support", "deflationary", percentages.
- The launch platform is named as a fact ("Launching on pump.fun"). It is
  linked only once the token is live, and never as a call to buy.
- The site's main call to action is always **Open JustResize**. The token page's
  is **Copy address**, beside the address itself. "Buy" is not a button anywhere;
  the homepage's small chart links to the coin's pump.fun page.
- An address is only ever shown from `lib/config/site.ts`. No graphic, post or
  page carries a placeholder address.

## Social assets

All generated by `npm run brand:export` from `brand-assets/templates/` into
`brand-assets/exports/`. Edit the HTML, re-run, done.

| Asset | File | Size |
| --- | --- | --- |
| Profile picture | `justresize-avatar-1024.png` (+ `-400`) | 1024 × 1024 |
| Token profile picture | `justresize-token-avatar-1024.png` (+ `-400`) | 1024 × 1024 |
| X header | `justresize-x-header.png` (+ `@2x`) | 1500 × 500 |
| X header, alternatives | `x-headers/justresize-x-header-*.png` (+ `@2x`) | 1500 × 500 |
| X header, token | `justresize-x-header-token.png` (+ `@2x`) | 1500 × 500 |
| Share image | `justresize-og.png` | 1200 × 630 |
| Share image, token | `justresize-token-og.png` | 1200 × 630 |
| Share image, each tool page | `og/<slug>.png` | 1200 × 630 |
| Posts | `justresize-post-*.png` | 1600 × 900 |

- Avatars have no text and keep the mark inside the central 45%, so a circular
  crop loses nothing.
- Headers keep everything between y = 110 and y = 390 and right of x = 110: the
  profile picture covers the bottom-left corner and phones crop top and bottom.
- The X header is the homepage hero in miniature: the headline pair, the image
  flow line between them, "JustResize / Solana" above. No address, ever.
- Six alternatives are in `exports/x-headers/`, to choose from: three quiet ones
  (a small mark, the address and one line, on dark, cobalt or paper), `measure`
  (`5.8 MB → 482 KB`), `squeeze` (the word "Compression" at three widths) and
  `tiles` (the sample image). Text in a header is never below 36 px: X shows
  the image at well under half size.
- Draft copy for posts and the profile is in `brand-assets/social-copy.md`.
