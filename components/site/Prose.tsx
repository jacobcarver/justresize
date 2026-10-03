import { siteContainer, SiteFooter, SiteHeader } from "./SiteChrome";

/**
 * Long-form pages (about, privacy, terms): one readable column. Headings,
 * paragraphs and lists inside are styled here, so the pages themselves are
 * plain markup and stay easy to edit.
 */
const prose =
  "max-w-[42rem] text-base leading-relaxed text-fg-secondary " +
  "[&_h2]:mt-10 [&_h2]:scroll-mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-[-0.01em] [&_h2]:text-fg " +
  "[&_p]:mt-3 [&_ul]:mt-3 [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-1.5 [&_ul]:pl-5 [&_ul]:marker:text-fg-disabled " +
  "[&_strong]:font-medium [&_strong]:text-fg " +
  // Plain links only: anything with its own classes (a button-styled link) keeps its own look.
  "[&_a:not([class])]:rounded-control [&_a:not([class])]:text-fg [&_a:not([class])]:underline [&_a:not([class])]:decoration-line-strong [&_a:not([class])]:underline-offset-4 [&_a:not([class]):hover]:decoration-fg";

interface ProsePageProps {
  /** The path of the page, to mark it in the header. */
  current: string;
  title: string;
  /** One or two sentences under the title. */
  lead?: React.ReactNode;
  /** ISO date, shown as "Last updated". */
  updated?: string;
  children: React.ReactNode;
}

export function ProsePage({ current, title, lead, updated, children }: ProsePageProps) {
  return (
    <>
      <SiteHeader current={current} />
      <main className={`${siteContainer} pb-20 pt-12 sm:pt-16`}>
        <h1 className="type-display text-[2.5rem] font-semibold leading-[1.04] tracking-[-0.02em] sm:text-[3.75rem]">{title}</h1>
        {lead && <p className="mt-4 max-w-[36rem] text-lg leading-relaxed text-fg-secondary">{lead}</p>}
        {updated && (
          <p className="mt-4 text-ui text-fg-tertiary">
            Last updated <time dateTime={updated}>{formatDate(updated)}</time>
          </p>
        )}
        <div className={`mt-6 ${prose}`}>{children}</div>
      </main>
      <SiteFooter />
    </>
  );
}

function formatDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" }).format(date);
}
