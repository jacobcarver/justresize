"use client";

import { useId, useState } from "react";
import { ChevronDownIcon } from "@/components/ui/icons";

export interface QuestionEntry {
  question: string;
  answer: string;
}

/**
 * The homepage's questions. On a wide screen it is a plain two-column list
 * with every answer showing. On a phone each question is a button that
 * opens its answer, one at a time, so the list is short enough to scan.
 *
 * Both are the same markup. The phone's button and the wide screen's plain
 * text are each hidden where the other shows, and the answer is always in
 * the page (search engines read it, and it matches the FAQ structured
 * data); on a phone it is only collapsed.
 */
export function Questions({ entries }: { entries: QuestionEntry[] }) {
  const id = useId();
  const [open, setOpen] = useState<number | null>(null);

  return (
    <dl className="divide-y divide-line-subtle border-y border-line-subtle">
      {entries.map((entry, index) => {
        const expanded = open === index;
        return (
          <div key={entry.question} className="md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-x-10 md:py-5">
            <dt className="text-base font-medium text-fg">
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={`${id}-${index}`}
                onClick={() => setOpen(expanded ? null : index)}
                className="flex w-full items-center justify-between gap-4 rounded-control py-4 text-left md:hidden"
              >
                {entry.question}
                <ChevronDownIcon
                  width={18}
                  height={18}
                  className={`shrink-0 text-fg-tertiary transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}
                />
              </button>
              <span className="hidden md:inline">{entry.question}</span>
            </dt>
            {/* Rows animate between 0fr and 1fr, which is how a height of "auto" can be transitioned. */}
            <dd
              id={`${id}-${index}`}
              className={`faq-answer grid text-base leading-relaxed text-fg-secondary transition-[grid-template-rows,visibility] duration-300 ease-out md:visible md:grid-rows-[1fr] ${
                expanded ? "visible grid-rows-[1fr]" : "invisible grid-rows-[0fr]"
              }`}
            >
              <span className="block min-h-0 overflow-hidden">
                <span className="block pb-4 md:pb-0">{entry.answer}</span>
              </span>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
