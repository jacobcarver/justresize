import Link from "next/link";
import { Wordmark } from "@/components/brand/Mark";
import { JsonLd } from "@/components/site/JsonLd";
import { ShieldCheckIcon } from "@/components/ui/icons";
import { Tooltip } from "@/components/ui/Tooltip";
import { TOKEN_CONFIG } from "@/lib/config/site";
import { breadcrumbLd, faqLd, webApplicationLd } from "@/lib/seo";
import { APP_TOOL, TOOLS, type ToolDefinition } from "@/lib/tools/definitions";
import { WorkspaceLoader } from "./WorkspaceLoader";

const PRIVACY_NOTE = "Your images are processed in your browser and never uploaded.";

const quietLink = "rounded-control transition-colors duration-150 hover:text-fg";

/**
 * Server-rendered frame around the app: the bar at the top, the tool's own
 * page underneath and the links at the bottom are static HTML; the workspace
 * itself is a client-only island.
 *
 * On wide screens the settings inspector is docked to the right edge under
 * the bar once images are open (see Workspace), and everything here leaves
 * that column free through --inspector-space. The page itself scrolls; the
 * inspector and its Resize button stay put.
 */
export function ToolShell({ tool }: { tool: ToolDefinition }) {
  const isApp = tool.slug === APP_TOOL.slug;
  const path = `/${tool.slug}`;

  return (
    <>
      <header className="z-30 flex h-(--header-h) shrink-0 items-center gap-3 border-b border-line-subtle bg-background px-4 lg:sticky lg:top-0 lg:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2 rounded-control" title="JustResize home">
          <Wordmark />
        </Link>
        {isApp ? (
          <h1 className="sr-only">{tool.heading}</h1>
        ) : (
          <>
            <span className="text-fg-disabled" aria-hidden>
              /
            </span>
            <h1 className="min-w-0 truncate text-ui font-medium">{tool.heading}</h1>
          </>
        )}
        <p className="hidden min-w-0 truncate text-ui text-fg-tertiary md:block">{tool.description}</p>

        {/* The way back to the site, kept small: this bar belongs to the tool. */}
        <nav aria-label="Site" className="ml-auto hidden shrink-0 items-center gap-4 text-ui text-fg-tertiary sm:flex">
          <Link href="/" className={quietLink}>
            Home
          </Link>
          {TOKEN_CONFIG.enabled && (
            <Link href="/token" className={quietLink}>
              Token
            </Link>
          )}
        </nav>
        <Tooltip label={PRIVACY_NOTE} side="bottom" align="end" wrap focus="any" className="ml-auto shrink-0 sm:ml-0">
          <button
            type="button"
            aria-describedby="privacy-note"
            className="flex h-8 cursor-default items-center gap-1.5 rounded-control px-2 text-ui text-fg-secondary transition-colors duration-150 hover:bg-surface-hover hover:text-fg"
          >
            <ShieldCheckIcon className="text-success" />
            Local processing
          </button>
        </Tooltip>
        <span id="privacy-note" className="sr-only">
          {PRIVACY_NOTE}
        </span>
      </header>

      <main className="flex flex-1 flex-col lg:pr-(--inspector-space)">
        <WorkspaceLoader initialConfig={tool.initialConfig} presetNote={tool.presetNote} />
        {tool.sections && <ToolPage tool={tool} />}
      </main>

      <footer className="pb-[calc(var(--dock-space)+1.25rem)] text-xs text-fg-tertiary lg:pr-(--inspector-space)">
        <div className="mx-auto w-full max-w-[84rem] px-4 lg:px-6">
          <nav aria-label="Tools" className="flex flex-wrap gap-x-5 gap-y-2 border-t border-line-subtle pt-4">
            {TOOLS.map((entry) => (
              <Link
                key={entry.slug}
                href={`/${entry.slug}`}
                aria-current={entry.slug === tool.slug ? "page" : undefined}
                className={`${quietLink} aria-[current=page]:text-fg-secondary`}
              >
                {entry.navLabel}
              </Link>
            ))}
            <span className="hidden flex-1 sm:block" aria-hidden />
            <Link href="/privacy" className={quietLink}>
              Privacy
            </Link>
            <Link href="/terms" className={quietLink}>
              Terms
            </Link>
          </nav>
        </div>
      </footer>

      <JsonLd data={webApplicationLd({ path, name: isApp ? "JustResize" : `JustResize: ${tool.heading}`, description: tool.description })} />
      {!isApp && (
        <JsonLd
          data={breadcrumbLd([
            { name: "JustResize", path: "/" },
            { name: tool.heading, path },
          ])}
        />
      )}
      {tool.faq && <JsonLd data={faqLd(tool.faq)} />}
    </>
  );
}

/** What a tool page says for itself, under the tool: short, specific, and never in the way of the workspace. */
function ToolPage({ tool }: { tool: ToolDefinition }) {
  return (
    <article className="mx-auto w-full max-w-[84rem] px-4 pb-10 pt-4 lg:px-6">
      <div className="tool-page max-w-[56rem] border-t border-line-subtle pt-8">
        <div className="grid gap-x-10 gap-y-8 md:grid-cols-2">
          {tool.sections?.map((section) => (
            <section key={section.heading}>
              <h2 className="text-base font-semibold tracking-[-0.01em] text-fg">{section.heading}</h2>
              {section.body.map((paragraph) => (
                <p key={paragraph} className="mt-2 leading-relaxed text-fg-secondary">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>

        {tool.faq && (
          <section className="mt-10" aria-labelledby="faq-heading">
            <h2 id="faq-heading" className="text-base font-semibold tracking-[-0.01em] text-fg">
              Questions
            </h2>
            <dl className="mt-3 divide-y divide-line-subtle border-y border-line-subtle">
              {tool.faq.map((entry) => (
                <div key={entry.question} className="grid gap-x-10 gap-y-1 py-3.5 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                  <dt className="font-medium text-fg">{entry.question}</dt>
                  <dd className="leading-relaxed text-fg-secondary">{entry.answer}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}
      </div>
    </article>
  );
}
