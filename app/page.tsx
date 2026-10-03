import type { Metadata } from "next";
import Link from "next/link";
import { HomeDrop } from "@/components/site/HomeDrop";
import { BatchFigure, LocalFlowFigure, order, TargetScale } from "@/components/site/HomeFigures";
import { JsonLd } from "@/components/site/JsonLd";
import { LaunchBanner } from "@/components/site/LaunchBanner";
import { DemoSizes, ResizeDemo } from "@/components/site/ResizeDemo";
import { Questions } from "@/components/site/Questions";
import { Reveal } from "@/components/site/Reveal";
import { siteContainer, SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { WorkspaceFigure } from "@/components/site/WorkspaceFigure";
import { CopyAddress } from "@/components/token/AddressField";
import { Sparkline } from "@/components/token/Sparkline";
import { buttonClass } from "@/components/ui/Button";
import { ArrowRightIcon, TrendDownIcon, TrendUpIcon } from "@/components/ui/icons";
import { adsenseClient } from "@/lib/ads";
import { SITE } from "@/lib/config/site";
import { faqLd, HOME_TITLE, organizationLd, pageMetadata, webApplicationLd, webSiteLd } from "@/lib/seo";
import { getToken, type TokenView } from "@/lib/token";
import { getTokenActivity } from "@/lib/token-activity";
import { changeInWords, formatChange, type TokenActivity } from "@/lib/token-chart";

export const metadata: Metadata = pageMetadata({
  title: HOME_TITLE,
  description: SITE.description,
  path: "/",
});

/*
 * Three sizes of type carry the page. `display` is the hero and the sections
 * that are meant to stop the scroll; `headline` is every other section;
 * `figure` is the one statement big enough to be the picture. Display type
 * is condensed (.type-display), which is what lets it be this large.
 */
const display = "type-display text-balance text-[length:clamp(2.75rem,8.2vw,6.25rem)] font-semibold leading-[0.98] tracking-[-0.025em]";
const headline = "type-display text-balance text-[length:clamp(2.125rem,5vw,3.75rem)] font-semibold leading-[1.02] tracking-[-0.02em]";
const figure = "type-display text-[length:clamp(2.75rem,10.5vw,8.25rem)] font-semibold leading-[0.94] tracking-[-0.03em]";
const lead = "text-base leading-relaxed text-fg-secondary";
const textLink = "rounded-control text-fg underline decoration-line-strong underline-offset-4 transition-colors duration-150 hover:decoration-fg";
const sectionPad = "py-20 sm:py-28";

/** Shown on the page and, word for word, in its FAQ structured data. Every answer must be true of the tool. */
const QUESTIONS = [
  {
    question: "Is JustResize free?",
    // Only said while it is true: the sentence about advertising follows the config.
    answer: `Yes. There is no account, no trial and no paid tier.${adsenseClient() ? " The site carries advertising." : ""}`,
  },
  {
    question: "Are my images uploaded?",
    answer:
      "No. Your browser reads the file, compresses or resizes it on your device and saves the result as a new file. JustResize has no server that receives images.",
  },
  {
    question: "How do I compress an image to a size like 500 KB?",
    answer:
      "Open the tool, choose File size and enter the limit. JustResize searches for the highest quality that fits under it, and reduces dimensions only if quality alone can't get there.",
  },
  {
    question: "Which formats does it work with?",
    answer:
      "It opens JPEG, PNG, WebP and still GIF images, AVIF where your browser can read it, and HEIC photos in Safari. It saves JPEG, PNG, WebP and AVIF.",
  },
  {
    question: "Can I compress many images at once?",
    answer:
      "Yes, as many as you like. There is no cap on how many images you add or on their file size; very large batches are limited only by your device's memory. One setting applies to all of them, and the results download as one ZIP.",
  },
];

/** The token's state as the homepage words it: before launch it says where the launch will be. */
function statusText(token: TokenView): string {
  if (token.status === "prelaunch" && token.launchPlatform) return `Launching on ${token.launchPlatform}`;
  return token.statusLabel;
}

/** The hero's second line. It only speaks for a token that is launching or live. */
function heroTokenLine(token: TokenView): string | null {
  if (!token.enabled) return null;
  if (token.live) return `Token live on ${token.network}.`;
  return token.status === "prelaunch" ? `Token launching on ${token.network}.` : null;
}

/**
 * The token's last 24 hours, kept small: a sparkline and the change it
 * shows, on a line of its own under the hero's token line, with the token's
 * address beside it to copy. The chart opens the coin's page on its launch
 * platform (pump.fun), or the token page if there is no such page.
 *
 * On the live site it only exists once there is a live token with activity
 * to show; in development it is drawn from the example coin and says so.
 */
function TokenPulse({ activity }: { activity: TokenActivity }) {
  const Trend = activity.changePercent >= 0 ? TrendUpIcon : TrendDownIcon;
  const summary = `Token activity over the last 24 hours: ${changeInWords(activity.changePercent)}.`;
  const chart = (
    <>
      <Sparkline activity={activity} className="h-8 w-24 sm:h-9 sm:w-28" />
      <span className="inline-flex items-center gap-1 text-ui text-fg-secondary sm:text-base">
        <Trend width={14} height={14} className={activity.changePercent >= 0 ? "text-success" : "text-danger"} />
        <span className="font-mono">{formatChange(activity.changePercent)}</span>
        24h
      </span>
    </>
  );
  const linkClass = "inline-flex items-center gap-3 whitespace-nowrap rounded-control";

  return (
    <span className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
      {activity.platformUrl ? (
        <a
          href={activity.platformUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${summary} Opens the token on ${activity.platform ?? "its launch platform"} in a new tab.`}
          data-testid="token-pulse"
          className={linkClass}
        >
          {chart}
        </a>
      ) : (
        <Link href="/token#activity" aria-label={`${summary} Details on the token page.`} data-testid="token-pulse" className={linkClass}>
          {chart}
        </Link>
      )}
      <CopyAddress name="Token address" address={activity.mint} />
      {/* Development only: the chart and the address are another coin's until the token is live. */}
      {activity.example && <span className="text-ui text-fg-tertiary">example coin</span>}
    </span>
  );
}

function Fact({ term, children, index }: { term: string; children: React.ReactNode; index: number }) {
  return (
    <div className="reveal grid grid-cols-[6.5rem_minmax(0,1fr)] items-baseline gap-x-6 py-3.5" style={order(index)}>
      <dt className="text-ui text-fg-tertiary">{term}</dt>
      <dd className="min-w-0 text-base text-fg">{children}</dd>
    </div>
  );
}

export default async function HomePage() {
  const token = getToken();
  const tokenLine = heroTokenLine(token);
  // Null before launch and whenever the data source is unreachable; the line then stands on its own.
  const activity = await getTokenActivity(token);

  return (
    <>
      {SITE.launchBanner && token.enabled && (
        <LaunchBanner
          // Live: the token by its ticker ("The official $RESIZE token is live."), or by the project's name until one is set.
          message={token.live ? `The official ${token.ticker ?? SITE.name} token is live.` : `JustResize token launching on ${token.network}.`}
          linkLabel={token.live ? "View now" : "Learn more"}
          href="/token"
        />
      )}
      <SiteHeader current="/" />

      <main>
        {/*
          The hero: the headline pair, the way in, and the workspace, which runs off the right edge on wide
          screens. It arrives in order, each part fading in and rising a little (.hero-in, .hero-figure).
        */}
        <ResizeDemo>
          <section className="overflow-hidden">
            <div className={`${siteContainer} grid gap-x-12 pb-16 pt-9 sm:pt-12 lg:grid-cols-12 lg:pb-24 lg:pt-14`}>
              <div className="lg:col-span-12">
                <h1 className={`${display} hero-in`}>Private compression tool.</h1>
                {tokenLine && (
                  <p className={`${display} hero-in text-fg-tertiary`} style={order(2)}>
                    {tokenLine}
                  </p>
                )}
                {tokenLine && activity && (
                  <p className="hero-in mt-4 sm:mt-5" style={order(3)}>
                    <TokenPulse activity={activity} />
                  </p>
                )}
              </div>

              <div className="mt-5 lg:col-span-4 lg:mt-10">
                <p className="hero-in max-w-[30rem] text-lg leading-relaxed text-fg-secondary" style={order(4)}>
                  Compress, resize, crop and convert images locally in your browser.
                </p>
                <div className="hero-in mt-6 flex flex-wrap items-center gap-2.5" style={order(5)}>
                  <Link href="/app" className={buttonClass("primary", "lg")}>
                    Open JustResize
                  </Link>
                  {token.enabled && (
                    <Link href="/token" className={`group ${buttonClass("ghost", "lg")}`}>
                      About the token
                      <ArrowRightIcon width={16} height={16} className="transition-transform duration-200 group-hover:translate-x-0.5" />
                    </Link>
                  )}
                </div>
                <p className="hero-in mt-3 text-ui text-fg-tertiary touch:hidden" style={order(6)}>
                  Or drop images anywhere on this page.
                </p>
              </div>

              <div className="hero-figure mt-10 min-w-0 lg:col-span-8">
                {/*
                  The figure runs to the window's right edge, the way the app docks its inspector there. On an
                  ultrawide screen (2000 px and up) that would stretch it across the monitor, so there it is a fixed
                  size instead, a little wider than its column, and WorkspaceFigure closes its right side.
                */}
                <div className="lg:w-[calc(100%_+_max(0px,_50vw_-_36rem)_+_4.5rem)] min-[125rem]:w-[calc(100%_+_18.5rem)]">
                  <WorkspaceFigure />
                </div>
                <DemoSizes className="mt-3" />
              </div>
            </div>
          </section>
        </ResizeDemo>

        <section className="paper" aria-labelledby="target-heading">
          <div className={`${siteContainer} ${sectionPad}`}>
            <Reveal className="grid gap-x-12 gap-y-6 lg:grid-cols-12 lg:items-end">
              <h2 id="target-heading" className={`${display} reveal lg:col-span-7`}>
                Need it under 500&nbsp;KB?
              </h2>
              <div className="reveal lg:col-span-4 lg:col-start-9" style={order(1)}>
                <p className="text-base leading-relaxed text-fg">Set the limit. JustResize finds the highest-quality result that fits.</p>
                <p className="mt-2 text-ui text-fg-tertiary">Dimensions come down only if quality alone can&apos;t get there.</p>
                <p className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
                  <Link href="/reduce-image-file-size" className={textLink}>
                    Reduce an image to a file size
                  </Link>
                  <Link href="/compress-image" className={textLink}>
                    Compress without resizing
                  </Link>
                </p>
              </div>
            </Reveal>
            <TargetScale className="mt-14 sm:mt-20" />
          </div>
        </section>

        <section aria-labelledby="batch-heading">
          <div className={`${siteContainer} ${sectionPad}`}>
            <Reveal amount={0.5} step={160}>
              {/* The page's largest type: two short claims, the second dimmer, like the hero's pair. */}
              <h2 id="batch-heading" className={`${figure} text-balance`}>
                <span className="reveal block">Unlimited images.</span>
                <span className="reveal block text-fg-tertiary" style={order(1)}>
                  No file size limit.
                </span>
              </h2>
            </Reveal>
            <div className="mt-14 grid gap-x-12 gap-y-8 lg:grid-cols-12">
              <div className="lg:col-span-3">
                <p className={lead}>One setting, applied to every image. One ZIP out.</p>
                <p className="mt-5">
                  <Link href="/bulk-image-resizer" className={textLink}>
                    Resize images in bulk
                  </Link>
                </p>
              </div>
              <div className="lg:col-span-8 lg:col-start-5">
                <BatchFigure />
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="border-t border-line-subtle" aria-labelledby="privacy-heading">
          <div className={`${siteContainer} ${sectionPad}`}>
            <Reveal className="grid gap-x-12 gap-y-10 lg:grid-cols-12" step={140}>
              <div className="reveal lg:col-span-6">
                <h2 id="privacy-heading" className={headline}>
                  Your images never leave your browser.
                </h2>
                <p className={`mt-5 max-w-[30rem] ${lead}`}>
                  Image processing happens locally on your device. JustResize does not upload your images to process them.
                </p>
                <p className="mt-5">
                  <Link href="/privacy" className={textLink}>
                    Read the privacy policy
                  </Link>
                </p>
              </div>
              <ul className="type-display divide-y divide-line-subtle border-y border-line-subtle text-[length:clamp(1.625rem,3.2vw,2.375rem)] font-semibold leading-tight tracking-[-0.015em] lg:col-span-5 lg:col-start-8">
                {["No upload.", "No cloud processing.", "No account required."].map((item, index) => (
                  <li key={item} className="reveal py-4" style={order(index + 1)}>
                    {item}
                  </li>
                ))}
              </ul>
            </Reveal>
            <LocalFlowFigure className="mt-12 sm:mt-16" />
          </div>
        </section>

        {token.enabled && (
          <section className="border-t border-line-subtle bg-surface-1" aria-labelledby="token-heading">
            <Reveal className={`${siteContainer} grid gap-x-12 gap-y-10 lg:grid-cols-12 ${sectionPad}`}>
              <div className="reveal lg:col-span-8">
                <h2 id="token-heading" className={display}>
                  JustResize&nbsp;<span className="font-normal text-fg-tertiary">×</span> {token.network}
                </h2>
                <p className="mt-6 max-w-[34rem] text-fg">
                  Always verify the official mint on JustResize before interacting with the token.
                  {!token.mint && " Until one is published here, no token is the JustResize token."}
                </p>
                <p className="mt-2 max-w-[34rem] text-fg-secondary">The tool needs no wallet, no token and no account, and that will not change.</p>
              </div>

              <div className="lg:col-span-4 lg:col-start-9 lg:pt-3">
                <dl className="divide-y divide-line-subtle border-y border-line-subtle">
                  <Fact term="Network" index={1}>
                    {token.network}
                  </Fact>
                  <Fact term="Status" index={2}>
                    {statusText(token)}
                  </Fact>
                </dl>
                <div className="reveal mt-8 flex flex-wrap gap-2.5" style={order(3)}>
                  <Link href="/token" className={buttonClass("secondary", "lg")}>
                    Token details
                  </Link>
                  {token.launchPlatformUrl && (
                    <a href={token.launchPlatformUrl} target="_blank" rel="noopener noreferrer" className={buttonClass("ghost", "lg")}>
                      View on {token.launchPlatform}
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  )}
                </div>
              </div>
            </Reveal>
          </section>
        )}

        <section className="border-t border-line-subtle" aria-labelledby="questions-heading">
          <div className={`${siteContainer} grid gap-x-12 gap-y-8 lg:grid-cols-12 ${sectionPad}`}>
            <h2 id="questions-heading" className={`${headline} lg:col-span-4`}>
              Questions
            </h2>
            <div className="lg:col-span-8">
              <Questions entries={QUESTIONS} />
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
      <HomeDrop />
      <JsonLd data={organizationLd()} />
      <JsonLd data={webSiteLd()} />
      <JsonLd data={webApplicationLd({ path: "/app", name: SITE.name, description: SITE.description })} />
      <JsonLd data={faqLd(QUESTIONS)} />
    </>
  );
}
