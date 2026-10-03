"use client";

import { useEffect, useRef, useState } from "react";
import { buttonClass } from "@/components/ui/Button";
import { CheckIcon, CopyIcon } from "@/components/ui/icons";
import { shortAddress } from "@/lib/token";

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    // No clipboard permission, or an insecure context: fall back to a selection copy.
    const area = document.createElement("textarea");
    area.value = value;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    let copied = false;
    try {
      copied = document.execCommand("copy");
    } catch {
      copied = false;
    }
    area.remove();
    return copied;
  }
}

/** Copies an address and says, for a moment, whether it worked. */
function useCopy(address: string) {
  const [feedback, setFeedback] = useState<"copied" | "failed" | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    const copied = await copyText(address);
    setFeedback(copied ? "copied" : "failed");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setFeedback(null), 1500);
  };

  return { feedback, copy };
}

interface AddressProps {
  /** What the address is, e.g. "Token address". Used in the control labels. */
  name: string;
  /** A validated address. */
  address: string;
}

/**
 * An on-chain address shown so it can be checked and copied exactly: the
 * whole value on wide screens, shortened only on narrow ones, with the whole
 * value always what the Copy button copies. It is only rendered for an
 * address that exists.
 */
export function AddressField({ name, address }: AddressProps) {
  const { feedback, copy } = useCopy(address);

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <code className="block font-mono text-[0.9375rem] text-fg" data-testid="token-address" data-address={address}>
        {/* Screen readers and wide screens get the whole address; narrow screens a shortened view of it. */}
        <span className="sr-only sm:not-sr-only sm:break-all">{address}</span>
        <span className="sm:hidden" aria-hidden title={address}>
          {shortAddress(address, 8)}
        </span>
      </code>
      <button type="button" onClick={() => void copy()} className={buttonClass("primary", "lg")} aria-label={`Copy ${name.toLowerCase()}`}>
        {feedback === "copied" ? <CheckIcon width={16} height={16} /> : <CopyIcon width={16} height={16} />}
        {feedback === "copied" ? "Copied" : "Copy address"}
      </button>
      <span role="status" aria-live="polite" className={feedback === "failed" ? "text-ui text-danger" : "sr-only"}>
        {feedback === "copied" ? `${name} copied.` : feedback === "failed" ? "Couldn't copy. Select the address and copy it by hand." : ""}
      </span>
    </div>
  );
}

/**
 * The same thing at the size of a label, for beside the homepage's small
 * chart: a shortened address that copies the whole one when pressed.
 */
export function CopyAddress({ name, address }: AddressProps) {
  const { feedback, copy } = useCopy(address);

  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label={`Copy ${name.toLowerCase()}`}
      title={address}
      data-testid="copy-address"
      className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-control border border-line px-2.5 text-ui text-fg-secondary transition-colors duration-150 hover:border-line-strong hover:text-fg touch:h-10"
    >
      {feedback === "copied" ? <CheckIcon width={14} height={14} className="text-success" /> : <CopyIcon width={14} height={14} />}
      <span className="font-mono">{feedback === "copied" ? "Copied" : feedback === "failed" ? "Couldn't copy" : shortAddress(address, 4)}</span>
      <span role="status" aria-live="polite" className="sr-only">
        {feedback === "copied" ? `${name} copied.` : ""}
      </span>
    </button>
  );
}
