# Token launch checklist

**LEGAL REVIEW RECOMMENDED BEFORE TOKEN LAUNCH.**

Nothing in this repository is legal, tax or financial advice, and no code or
wording in it settles a legal question. The site's copy was written to be
factual and cautious; whether it is *sufficient* where you and your users are
is for a qualified professional to say. Treat every unchecked box below as a
reason not to switch the token to "live".

All values live in one file: `lib/config/site.ts`.

## 1. Before anything is public

- [ ] **Legal review** of the token itself, the `/token` page and the token
      section of `/terms`, by a lawyer who works with cryptoassets in your
      jurisdiction — in particular before making **any** revenue-linked claim.
- [ ] **Who operates the site.** Set `SITE.legal.operator` (person or company)
      and `SITE.legal.jurisdiction`. Until then the terms say "the JustResize
      project" and name no governing law.
- [ ] **Contact email.** Set `SITE.contactEmail`. Until then the privacy policy
      and terms show no contact section at all.
- [ ] **Jurisdiction restrictions.** Decide whether the token may be offered or
      promoted to people in particular countries (the US, UK, EU and others have
      specific rules on promoting cryptoassets). The site has no geo-blocking.
- [ ] **Tax and accounting treatment** of token issuance, any treasury, and any
      revenue moved on-chain.
- [ ] **Branding rights.** Check "JustResize" is free to use as a name/trademark
      where you operate, and register what you need.
- [ ] **Solana trademarks.** The site and assets write "Solana" as a word and do
      not use Solana's logo or colours. If you want the logo, read and follow the
      Solana Foundation's brand guidelines first.

## 2. Values to fill in (`TOKEN_CONFIG`)

- [ ] `name` and `ticker` — final, checked for clashes with existing tokens. The
      ticker is what the homepage banner announces ("The official $TICKER token
      is live.").
- [ ] `mintAddress` — copied from the chain, then **verified character by
      character** against the explorer by a second person. This is the single
      most damaging value to get wrong.
- [ ] `telegramUrl`, `discordUrl` — only channels that exist and that you
      control. Empty ones are not shown. (X is the project account in
      `SITE.links.x`.)
- [ ] `launchPlatform.url` — optional for pump.fun: the site derives
      `pump.fun/coin/<mint>` once the token is live. The site names the platform
      ("Launching on pump.fun") but links nowhere before launch. After launch,
      click the homepage chart and "View on pump.fun" and check they open *this*
      mint.
- [ ] `description` — one or two factual sentences on what the token is.
- [ ] `status: "live"` — **last**, after everything above. A "live" status
      without a valid mint is ignored and the page stays in pre-launch.

Then: `npm test` (the config is checked for coherence), `npm run brand:export`
(now also produces the launch post with the real mint), build, deploy, and
compare the address on the deployed page with the explorer once more.

## 3. Revenue wording

`/token` says: "Any money the site makes, from advertising or anything else,
will be put into the token." It covers all of the site's income, not only ads.
It was added on the owner's decision (2026-10-02), and the Risks
section was removed from that page at the same time; the risk disclosure now
lives only in `/terms#token`.

- [ ] **Legal review of that sentence before launch.** Tying a token to a
      project's revenue is exactly the kind of statement that can make it look
      like an investment in the project's efforts, which is how securities and
      financial-promotion rules get triggered in the US, UK and EU.
- [ ] **Decide what "put into the token" means** (how, how often, from which wallet,
      and whether it is before or after the site's costs and taxes) and
      whether it will be reported. The site names no mechanism because none has
      been decided; do not publish one that is not real.
- [ ] **Make it true.** Once it is on the page it is a public commitment about
      money. Keep records that show it being done.
- [ ] Nothing else has been written, deliberately: no revenue figure or
      comparison with what other sites earn, and nothing saying the token's
      price will rise if the site does well. Those are statements about returns
      that nobody can back up, and they are the ones regulators and buyers act on.
- [ ] `/terms#token` still says the token is not a share of revenue or profit and
      that plans are not promises. Read it against the new sentence and have the
      reviewer confirm the two fit together.
- [ ] Decide whether `/token` should link to the risk disclosure in the terms
      now that it has no Risks section of its own.

## 4. Statements the site makes that must stay true

- [ ] "Your images never leave your browser" / "no server that accepts images"
      — true as built. Adding any server-side processing breaks it.
- [ ] The advertising section of `/privacy`: ads are Google AdSense, Google's
      script is the only third-party code, and JustResize's own code sets no
      cookies and runs no analytics. Adding analytics or any other third-party
      script means updating `/privacy` **and** the Content-Security-Policy
      (`lib/config/csp.ts`) first.
- [ ] Consent: Google requires a certified consent message to serve ads in the
      EEA, the UK and Switzerland. Turn on Google's own in the AdSense console
      (Privacy & messaging) before launch.
- [ ] "The site carries advertising" (homepage FAQ) is true only while ads are
      on; it follows `SITE.adsenseClient` by itself.
- [ ] The activity chart is real data for the published mint, from
      GeckoTerminal. It needs no upkeep, but check on launch day that the
      figures on `/token` match the pool you expect.
- [ ] "Unlimited images. No file size limit." (homepage, tool pages, `/terms`).
      True because `maxFileBytes` and `maxBatchFiles` in `lib/config/limits.ts`
      are infinite. Bringing a cap back means changing that copy first.
- [ ] "Hosted by Vercel" (`/privacy`). Change it if the host changes.
- [ ] "The tool needs no wallet, no token and no account, and that will not
      change" (home, `/token`). This is a promise; keep it.
- [ ] "It does not unlock anything in the product" (`/token`). If token-gated
      features ever ship, this must change first.
- [ ] Dates: update `SITE.legal.lastUpdated` whenever `/privacy` or `/terms`
      changes.

## 5. Impersonation

- [ ] `SITE.links.x` is set to `https://x.com/justresize` (from the owner). Check
      the handle is registered and yours before announcing; the token page and
      the footer list it as the official account.
- [ ] Pin a post that points to `justresize.com/token` as the only source for
      the mint.
- [ ] Never post the mint as an image only; always link the page.
- [ ] Expect fake tokens using the name the moment the launch is announced. The
      pre-launch page already says "until an address appears here, no token is
      the JustResize token".
- [ ] Decide who can change `lib/config/site.ts` in production. Whoever can
      deploy can change the published mint.

## 6. What the site deliberately does not do

No wallet connection, swap, price chart, holder count, market cap or "buy"
button, and no blockchain libraries. Adding any of these changes the product's
risk and trust profile; treat it as a new decision, not a tweak.
