import Link from "next/link";
import { Wordmark } from "@/components/brand/Mark";
import { buttonClass } from "@/components/ui/Button";
import { XLogo } from "@/components/ui/icons";
import { SITE, TOKEN_CONFIG } from "@/lib/config/site";
import { TOOLS } from "@/lib/tools/definitions";
import { MobileMenu } from "./MobileMenu";

/** The measure every page of the public site shares. */
export const siteContainer = "mx-auto w-full max-w-[72rem] px-5 sm:px-8";

const navLink = "rounded-control text-fg-secondary transition-colors duration-150 hover:text-fg aria-[current=page]:text-fg";

interface NavEntry {
  href: string;
  label: string;
}

function navEntries(): NavEntry[] {
  return [
    { href: "/app", label: "Tool" },
    { href: "/#how-it-works", label: "How it works" },
    ...(TOKEN_CONFIG.enabled ? [{ href: "/token", label: "Token" }] : []),
    { href: "/about", label: "About" },
  ];
}

/**
 * The public site's header: the name, the links and the way into the tool.
 * On a phone the links live in a menu (MobileMenu.tsx) and the header is one
 * line. It scrolls away with the page: nothing on these pages needs it pinned.
 */
export function SiteHeader({ current }: { current?: string }) {
  const entries = navEntries();
  return (
    <header className="border-b border-line-subtle">
      <div className={`${siteContainer} flex h-14 items-center gap-x-3 sm:gap-x-6`}>
        <Link href="/" className="flex shrink-0 items-center gap-2 rounded-control" aria-current={current === "/" ? "page" : undefined}>
          <Wordmark size={22} />
        </Link>
        <nav aria-label="Site" className="ml-auto hidden items-center gap-6 text-sm sm:flex">
          {entries.map((entry) => (
            <Link key={entry.href} href={entry.href} aria-current={entry.href === current ? "page" : undefined} className={navLink}>
              {entry.label}
            </Link>
          ))}
        </nav>
        {/* On a phone the control size is finger-sized, which is too heavy for a header: this one is set a step smaller there. */}
        <Link href="/app" className={`${buttonClass("secondary", "md")} ml-auto max-sm:h-9 max-sm:px-3 max-sm:text-sm sm:ml-0`}>
          Open tool
        </Link>
        <MobileMenu entries={entries} current={current} />
      </div>
    </header>
  );
}

interface FooterLink extends NavEntry {
  external?: boolean;
  /** Shown before the label: the X logo for a link to X. */
  icon?: React.ReactNode;
}

function FooterColumn({ title, links, className = "" }: { title: string; links: FooterLink[]; className?: string }) {
  if (links.length === 0) return null;
  return (
    <div className={className}>
      <h2 className="text-ui font-medium text-fg">{title}</h2>
      <ul className="mt-3 flex flex-col gap-2">
        {links.map((link) => (
          <li key={link.href}>
            {link.external ? (
              <a href={link.href} target="_blank" rel="noopener noreferrer" className={`${navLink} inline-flex items-center gap-2`}>
                {link.icon}
                {link.label}
              </a>
            ) : (
              <Link href={link.href} className={navLink}>
                {link.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** "@justresize" from "https://x.com/justresize". */
export function xHandle(url: string): string {
  return `@${url.replace(/\/+$/, "").split("/").pop()}`;
}

/**
 * Every page of the public site ends the same way. Links with no configured
 * value are left out, never stubbed.
 *
 * On a phone it is two columns under the name: the tools on the left, and
 * the three short lists stacked on the right, which is about half the height
 * of one long column. From 640 px up every list is a column of its own.
 */
export function SiteFooter() {
  const product = [{ href: "/app", label: "Open tool" }, ...TOOLS.map((tool) => ({ href: `/${tool.slug}`, label: tool.navLabel }))];
  const project = [
    { href: "/about", label: "About" },
    ...(TOKEN_CONFIG.enabled ? [{ href: "/token", label: "Token" }] : []),
  ];
  const legal = [
    { href: "/privacy", label: "Privacy" },
    { href: "/terms", label: "Terms" },
  ];
  const social: FooterLink[] = [
    ...(SITE.links.x ? [{ href: SITE.links.x, label: xHandle(SITE.links.x), external: true, icon: <><XLogo width={14} height={14} /><span className="sr-only">X</span></> }] : []),
    ...(SITE.links.github ? [{ href: SITE.links.github, label: "GitHub", external: true }] : []),
  ];

  return (
    <footer className="mt-auto border-t border-line-subtle">
      <div
        className={`${siteContainer} grid grid-cols-2 gap-x-8 gap-y-8 py-10 text-sm sm:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))] sm:gap-y-10 sm:py-12 ${
          social.length > 0 ? "lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]" : ""
        }`}
      >
        <div className="col-span-2 sm:col-span-1">
          <Link href="/" className="inline-flex items-center gap-2 rounded-control">
            <Wordmark />
          </Link>
          <p className="mt-3 max-w-[22rem] text-fg-tertiary">{SITE.tagline}</p>
        </div>
        <FooterColumn title="Product" links={product} />
        {/* One stacked column on a phone; from sm up the wrapper disappears and each list takes its own grid column. */}
        <div className="flex flex-col gap-7 sm:contents">
          <FooterColumn title="Project" links={project} />
          <FooterColumn title="Legal" links={legal} />
          <FooterColumn title="Social" links={social} />
        </div>
      </div>
    </footer>
  );
}
