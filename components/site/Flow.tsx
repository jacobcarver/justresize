import type { ReactNode } from "react";

/**
 * A flow line: nodes joined by thin directional lines, drawn the way the
 * app draws a measurement. It is illustration: wrap it in something with a
 * role and a label, and keep the flow itself hidden from assistive tech.
 */

export interface FlowStep {
  /** The node's name or value. */
  head: ReactNode;
  /** One quiet line under it. */
  sub?: ReactNode;
  /** The dot: hollow by default, cobalt for the step that matters (where the work happens, or where the flow ends up). */
  tone?: "plain" | "accent";
}

/** "row-from-lg" stacks the steps on narrow screens and lays them out as a line on wide ones. */
type Direction = "row" | "column" | "row-from-lg";

const ROOT: Record<Direction, string> = {
  row: "flex items-center gap-3",
  column: "flex flex-col",
  "row-from-lg": "flex flex-col lg:flex-row lg:items-center lg:gap-3",
};

const NODE: Record<Direction, string> = {
  row: "flex min-w-0 items-center gap-2.5",
  column: "flex items-start gap-2.5",
  "row-from-lg": "flex items-start gap-2.5 lg:min-w-0 lg:items-center",
};

const DOT_OFFSET: Record<Direction, string> = {
  row: "",
  column: "mt-[5px]",
  "row-from-lg": "mt-[5px] lg:mt-0",
};

/** The link between two nodes: a hairline and an arrowhead, pointing along the flow. */
const LINK: Record<Direction, string> = {
  row: "flex min-w-5 flex-1 items-center",
  column: "my-1 ml-0.5 flex h-5 w-1.5 flex-col items-center",
  "row-from-lg": "my-1 ml-0.5 flex h-5 w-1.5 flex-col items-center lg:m-0 lg:h-auto lg:w-auto lg:min-w-5 lg:flex-1 lg:flex-row",
};

/** --flow-angle tells the travelling highlight (`live`, see globals.css) which way this line runs. */
const LINE: Record<Direction, string> = {
  row: "h-px flex-1 [--flow-angle:90deg]",
  column: "w-px flex-1 [--flow-angle:180deg]",
  "row-from-lg": "w-px flex-1 [--flow-angle:180deg] lg:h-px lg:w-auto lg:[--flow-angle:90deg]",
};

const ARROW: Record<Direction, string> = {
  row: "-ml-1.5 rotate-45 border-r border-t",
  column: "-mt-1.5 rotate-45 border-b border-r",
  "row-from-lg": "-mt-1.5 rotate-45 border-b border-r lg:-ml-1.5 lg:mt-0 lg:border-b-0 lg:border-t",
};

const DOT: Record<NonNullable<FlowStep["tone"]>, string> = {
  plain: "border-line-strong",
  accent: "border-accent-text bg-accent-text",
};

interface FlowProps {
  steps: FlowStep[];
  direction?: Direction;
  /** A highlight keeps travelling along the lines: for a flow that is happening, not one that happened. */
  live?: boolean;
  className?: string;
}

export function Flow({ steps, direction = "row", live = false, className = "" }: FlowProps) {
  return (
    <div aria-hidden className={`${ROOT[direction]} ${live ? "flow-live" : ""} ${className}`}>
      {steps.map((step, index) => (
        // Fragments would need keys anyway; a contents wrapper keeps each link next to the node it leads to.
        <div key={index} className="contents">
          {index > 0 && (
            <span className={LINK[direction]}>
              <span className={`flow-line bg-line-strong ${LINE[direction]}`} />
              <span className={`size-1.5 shrink-0 border-line-strong ${ARROW[direction]}`} />
            </span>
          )}
          <div className={NODE[direction]}>
            <span className={`size-2.5 shrink-0 rounded-full border ${DOT[step.tone ?? "plain"]} ${DOT_OFFSET[direction]}`} />
            <div className="min-w-0">
              <p className="text-ui font-medium text-fg">{step.head}</p>
              {step.sub && <p className="text-xs text-fg-tertiary">{step.sub}</p>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
