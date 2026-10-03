"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { CloseIcon } from "@/components/ui/icons";

const STORAGE_KEY = "justresize:launch-banner-dismissed";
const CHANGE_EVENT = "justresize:launch-banner";

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => window.removeEventListener(CHANGE_EVENT, onChange);
}

function isDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * One line above the homepage for the launch period, switched on with
 * SITE.launchBanner. It says one thing and links to one place; dismissing
 * it is remembered in this browser.
 */
export function LaunchBanner({ message, linkLabel, href }: { message: string; linkLabel: string; href: string }) {
  const dismissed = useSyncExternalStore(subscribe, isDismissed, () => false);
  if (dismissed) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Storage blocked: the banner comes back on the next visit, which is fine.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };

  return (
    <div className="border-b border-line-subtle bg-surface-1">
      <div className="mx-auto flex w-full max-w-[72rem] items-center gap-3 px-5 py-1 text-ui sm:px-8">
        {/* News, not decoration: the dot marks the line as current. */}
        <span aria-hidden className="relative size-1.5 shrink-0">
          <span className="chart-ping absolute inset-0 rounded-full bg-accent-text" />
          <span className="absolute inset-0 rounded-full bg-accent-text" />
        </span>
        <p className="min-w-0 flex-1 truncate text-fg-secondary">
          {message}{" "}
          <Link href={href} className="rounded-control text-fg underline decoration-line-strong underline-offset-2 hover:decoration-fg">
            {linkLabel}
          </Link>
        </p>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="-mr-1.5 inline-flex size-7 shrink-0 items-center justify-center rounded-control text-fg-tertiary transition-colors duration-150 hover:bg-surface-hover hover:text-fg touch:size-9"
        >
          <CloseIcon width={14} height={14} />
        </button>
      </div>
    </div>
  );
}
