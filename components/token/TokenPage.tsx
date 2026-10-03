import Link from "next/link";
import { buttonClass } from "@/components/ui/Button";
import { TrendDownIcon, TrendUpIcon, XLogo } from "@/components/ui/icons";
import { SITE } from "@/lib/config/site";
import type { TokenView } from "@/lib/token";
import { changeInWords, formatChange, formatUsd, formatUsdCompact, type TokenActivity } from "@/lib/token-chart";
import { ActivityChart } from "./ActivityChart";
import { AddressField } from "./AddressField";

const textLink = "rounded-control text-fg underline decoration-line-strong underline-offset-4 transition-colors duration-150 hover:decoration-fg";

const STATUS_DOT: Record<TokenView["status"], string> = {
  prelaunch: "bg-fg-tertiary",
  // Cobalt, not green: "live" is a state, not a gain. Green and red are left to the activity chart's direction.
  live: "bg-accent-text",
  paused: "bg-warning",
  deprecated: "bg-fg-disabled",
};

/** The token's state in two words, from config. The words carry it; the dot only echoes them. */
export function TokenStatus({ token }: { token: TokenView }) {
  return (
    <p className="inline-flex items-center gap-2 text-ui font-medium text-fg-secondary" data-testid="token-status">
      <span className={`size-1.5 rounded-full ${STATUS_DOT[token.status]}`} aria-hidden />
      {token.statusLabel}
    </p>
  );
}

/** One titled part of the page: the heading in a narrow left column on wide screens, the content beside it. */
function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="grid gap-x-12 gap-y-4 border-t border-line-subtle py-10 lg:grid-cols-[15rem_minmax(0,1fr)] lg:py-12">
      <h2 id={`${id}-heading`} className="text-lg font-semibold tracking-[-0.01em]">
        {title}
      </h2>
      <div className="max-w-[40rem] text-base leading-relaxed text-fg-secondary">{children}</div>
    </section>
  );
}

function Detail({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-x-6 gap-y-1 py-3.5 sm:grid-cols-[9.5rem_minmax(0,1fr)]">
      <dt className="text-ui text-fg-tertiary">{term}</dt>
      <dd className="min-w-0 text-fg">{children}</dd>
    </div>
  );
}

/**
 * The last 24 hours of the token's price, read-only: four figures, the line
 * they describe, and where the data comes from. Only rendered when there is
 * a live token and data for it.
 */
function Activity({ activity }: { activity: TokenActivity }) {
  const up = activity.changePercent >= 0;
  const Trend = up ? TrendUpIcon : TrendDownIcon;
  const summary = `Price over the last 24 hours: ${changeInWords(activity.changePercent)}, now ${formatUsd(activity.price)}, between ${formatUsd(activity.low)} and ${formatUsd(activity.high)}.`;

  return (
    <div data-testid="token-activity">
      {activity.example && (
        <p className="mb-6 border-l-2 border-warning pl-3 text-ui text-fg">
          Example data from another coin, shown in development only. The live site shows this section once the JustResize token is
          live, with its own figures.
        </p>
      )}
      <dl className="flex flex-wrap gap-x-10 gap-y-5">
        <Figure term="Price">{formatUsd(activity.price)}</Figure>
        <Figure term="24h change">
          <span className="inline-flex items-center gap-1">
            <Trend width={16} height={16} className={up ? "text-success" : "text-danger"} />
            {formatChange(activity.changePercent)}
          </span>
        </Figure>
        <Figure term="24h range">
          {formatUsd(activity.low)} – {formatUsd(activity.high)}
        </Figure>
        <Figure term="24h volume">{formatUsdCompact(activity.volume)}</Figure>
      </dl>
      <div className="mt-7">
        <ActivityChart points={activity.points} up={up} summary={summary} />
      </div>
      <p className="mt-5 text-ui text-fg-tertiary">
        US dollar price in the token&apos;s most liquid pool, refreshed every few minutes. Data from{" "}
        <a href={activity.sourceUrl} target="_blank" rel="noopener noreferrer" className={textLink}>
          GeckoTerminal
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
        . It is shown for information and is not advice.
      </p>
    </div>
  );
}

function Figure({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-ui text-fg-tertiary">{term}</dt>
      <dd className="mt-1 whitespace-nowrap text-fg">
        <span className="font-mono">{children}</span>
      </dd>
    </div>
  );
}

/**
 * Everything on /token, as a function of the resolved token. It is an
 * information page: the official facts and addresses, what the project does
 * with the money the site makes and, once the token is live, a read-only
 * chart of its recent activity. It deliberately has no wallet connection,
 * no trading and nothing to buy. The risk disclosure is in /terms#token.
 */
export function TokenPage({ token, activity = null }: { token: TokenView; activity?: TokenActivity | null }) {
  const siteHost = SITE.url.replace(/^https:\/\//, "");
  const named = token.name ?? "the JustResize project token";
  // In the development preview the chart is the example coin's, so the address shown is that coin's too: the page then agrees with itself.
  const address = token.mint && activity?.example ? activity.mint : token.mint;

  return (
    <>
      <div className="pb-10 pt-12 sm:pb-14 sm:pt-16">
        <TokenStatus token={token} />
        <h1 className="type-display mt-4 text-[2.5rem] font-semibold leading-[1.04] tracking-[-0.02em] sm:text-[3.75rem]">JustResize on Solana</h1>
        <p className="mt-4 max-w-[36rem] text-lg leading-relaxed text-fg-secondary">
          {token.live
            ? `Official information about ${named}${token.ticker ? ` (${token.ticker})` : ""}.`
            : token.status === "prelaunch"
              ? "Official information about the JustResize project token. It has not launched yet. When it does, its address will be published here first."
              : `Official information about ${named}.`}
        </p>
        {token.statusNote && <p className="mt-4 max-w-[36rem] border-l-2 border-warning pl-3 text-fg">{token.statusNote}</p>}
        {/* The page's main action: the token's address, whole, with one button that copies it. */}
        {address && (
          <div className="mt-7">
            <p className="mb-2 text-ui text-fg-tertiary">Token address</p>
            <AddressField name="Token address" address={address} />
          </div>
        )}
      </div>

      <Section id="official" title="Official details">
        <dl className="divide-y divide-line-subtle border-y border-line-subtle">
          <Detail term="Status">{token.statusLabel}</Detail>
          <Detail term="Network">{token.network}</Detail>
          {token.name && <Detail term="Name">{token.name}</Detail>}
          {token.ticker && (
            <Detail term="Ticker">
              <span className="font-mono">{token.ticker}</span>
            </Detail>
          )}
          {token.launchPlatform && (
            <Detail term="Launch platform">
              {token.launchPlatformUrl ? (
                <a href={token.launchPlatformUrl} target="_blank" rel="noopener noreferrer" className={textLink}>
                  View on {token.launchPlatform}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              ) : (
                token.launchPlatform
              )}
            </Detail>
          )}
          <Detail term="Official website">{siteHost}</Detail>
          {SITE.links.x && (
            <Detail term="Official X">
              <a href={SITE.links.x} target="_blank" rel="noopener noreferrer" className={`${textLink} inline-flex items-center gap-2`}>
                <XLogo width={14} height={14} />
                {SITE.links.x.replace(/^https:\/\/(www\.)?/, "")}
              </a>
            </Detail>
          )}
          {token.channels.map((channel) => (
            <Detail key={channel.label} term={`Token ${channel.label}`}>
              <a href={channel.url} target="_blank" rel="noopener noreferrer" className={textLink}>
                {channel.url.replace(/^https:\/\/(www\.)?/, "").replace(/\/$/, "")}
              </a>
            </Detail>
          ))}
        </dl>
        <p className="mt-5 text-fg">
          {token.mint
            ? "Always check the token address against the one at the top of this page before you interact with the token."
            : `Only use an address published on ${siteHost}/token. Until one appears here, no token is the JustResize token.`}
        </p>
        <p className="mt-2">Addresses sent in replies, direct messages or ads should not be trusted, whoever appears to send them.</p>
      </Section>

      {activity && (
        <Section id="activity" title="Activity">
          <Activity activity={activity} />
        </Section>
      )}

      <Section id="about" title="What the token is">
        {token.description && <p className="mb-4 text-fg">{token.description}</p>}
        <p className="text-fg">
          JustResize is free to use. Any money the site makes, from advertising or anything else, will be put into the token.
        </p>
        <p className="mt-4">The tool itself never needs it: resizing works without a wallet, a token or an account.</p>
      </Section>

      <Section id="product" title="The product">
        <p>
          JustResize is an image resizer that runs entirely in your browser. It is the reason this project exists, and it is free to
          use whether or not you ever look at this page again.
        </p>
        <p className="mt-5">
          <Link href="/app" className={buttonClass("secondary", "md")}>
            Open JustResize
          </Link>
        </p>
      </Section>
    </>
  );
}
