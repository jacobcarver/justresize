import type { Metadata } from "next";
import Link from "next/link";
import { CornerFrame } from "@/components/brand/Mark";
import { siteContainer, SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { buttonClass } from "@/components/ui/Button";
import { TOOLS } from "@/lib/tools/definitions";

export const metadata: Metadata = {
  title: { absolute: "404 × 404 — Page not found | JustResize" },
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className={`${siteContainer} flex flex-1 flex-col items-start justify-center py-20`}>
        <div className="relative px-7 py-6">
          <CornerFrame className="inset-0" />
          <p className="font-mono text-[2.75rem] leading-none tracking-[-0.02em] sm:text-[4rem]">404 × 404</p>
        </div>
        <h1 className="mt-8 text-2xl font-semibold tracking-[-0.02em]">Image not found. Neither is the page.</h1>
        <p className="mt-2 max-w-[32rem] text-base leading-relaxed text-fg-secondary">
          Nothing lives at this address. The resizer is one click away.
        </p>
        <p className="mt-7">
          <Link href="/app" className={buttonClass("primary", "lg")}>
            Open JustResize
          </Link>
        </p>
        <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {[{ slug: "", navLabel: "Home" }, ...TOOLS].map((entry) => (
            <li key={entry.slug}>
              <Link href={`/${entry.slug}`} className="rounded-control text-fg-secondary transition-colors duration-150 hover:text-fg">
                {entry.navLabel}
              </Link>
            </li>
          ))}
        </ul>
      </main>
      <SiteFooter />
    </>
  );
}
