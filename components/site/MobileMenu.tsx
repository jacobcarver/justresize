"use client";

import Link from "next/link";
import { useEffect, useRef, type CSSProperties } from "react";
import { Wordmark } from "@/components/brand/Mark";
import { buttonClass } from "@/components/ui/Button";
import { CloseIcon } from "@/components/ui/icons";

interface MenuEntry {
  href: string;
  label: string;
}

/**
 * The site's navigation on a phone: a button in the header that opens the
 * links full screen, large enough to tap without aiming.
 *
 * It is a native modal <dialog>, so the browser handles what a menu must get
 * right: focus moves into it and stays there, Escape closes it, and the page
 * behind cannot be reached or scrolled while it is open.
 */
export function MobileMenu({ entries, current }: { entries: MenuEntry[]; current?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = () => dialog.current?.close();

  // Turning a phone sideways, or widening the window, brings the ordinary links back: the menu should not stay open over them.
  useEffect(() => {
    const wide = window.matchMedia("(width >= 40rem)");
    const onChange = () => {
      if (wide.matches) dialog.current?.close();
    };
    wide.addEventListener("change", onChange);
    return () => wide.removeEventListener("change", onChange);
  }, []);

  return (
    <>
      <button
        type="button"
        aria-label="Menu"
        aria-haspopup="dialog"
        onClick={() => dialog.current?.showModal()}
        className="-mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-control text-fg transition-colors duration-150 hover:bg-surface-hover sm:hidden"
      >
        <span aria-hidden className="flex w-5 flex-col gap-[5px]">
          <span className="h-[1.5px] rounded-full bg-current" />
          <span className="h-[1.5px] rounded-full bg-current" />
        </span>
      </button>

      <dialog
        ref={dialog}
        aria-label="Menu"
        // A tap on the dialog itself, outside its content, can only be the backdrop.
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
        className="site-menu m-0 h-dvh max-h-none w-full max-w-none flex-col bg-background text-fg open:flex"
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-line-subtle px-5">
          <Link href="/" onClick={close} className="flex items-center gap-2 rounded-control">
            <Wordmark size={22} />
          </Link>
          <button
            type="button"
            aria-label="Close menu"
            onClick={close}
            className="-mr-2 inline-flex size-11 items-center justify-center rounded-control text-fg transition-colors duration-150 hover:bg-surface-hover"
          >
            <CloseIcon width={20} height={20} />
          </button>
        </div>

        <nav aria-label="Site" className="flex flex-1 flex-col overflow-y-auto px-5 pt-3">
          {entries.map((entry, index) => (
            <Link
              key={entry.href}
              href={entry.href}
              onClick={close}
              aria-current={entry.href === current ? "page" : undefined}
              style={{ "--i": index } as CSSProperties}
              className="menu-item type-display border-b border-line-subtle py-5 text-[2.25rem] font-semibold leading-none tracking-[-0.02em] text-fg-secondary aria-[current=page]:text-fg"
            >
              {entry.label}
            </Link>
          ))}
        </nav>

        <div className="menu-item shrink-0 px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-5" style={{ "--i": entries.length } as CSSProperties}>
          <Link href="/app" onClick={close} className={`${buttonClass("primary", "lg")} w-full`}>
            Open JustResize
          </Link>
        </div>
      </dialog>
    </>
  );
}
