import { ArrowRightIcon, LockIcon } from "@/components/ui/icons";
import { DemoBytes, DemoFrame, DemoName, DemoPhotos, DemoSaving, DemoSize } from "./ResizeDemo";

/** A segmented control as it looks in the app, without being one. */
function Segments({ options, active }: { options: string[]; active: string }) {
  return (
    <div className="flex h-7 rounded-control bg-surface-2 p-0.5 text-xs">
      {options.map((option) => (
        <span
          key={option}
          className={`flex flex-auto items-center justify-center whitespace-nowrap rounded-[4px] px-2 font-medium ${
            option === active ? "bg-surface-3 text-fg shadow-[inset_0_0_0_1px_var(--border-subtle)]" : "text-fg-secondary"
          }`}
        >
          {option}
        </span>
      ))}
    </div>
  );
}

function FigureField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="mb-1.5 text-xs text-fg-secondary">{label}</p>
      <p className="flex h-8 items-center justify-between rounded-control border border-line bg-surface-2 px-2.5 font-mono text-ui text-fg">
        {value}
        <span className="font-sans text-xs text-fg-tertiary">px</span>
      </p>
    </div>
  );
}

/**
 * The homepage's picture of the product: the real workspace, drawn with the
 * app's own tokens and parts and showing one honest example. It is an
 * illustration — nothing in it is interactive — so assistive tech gets one
 * sentence instead of thirty pretend controls.
 *
 * The output size it shows comes from the resize demo (ResizeDemo.tsx), so
 * it must be rendered inside <ResizeDemo>. On wide screens the homepage runs
 * it off the right edge of the window, the way the app docks its inspector
 * there, which is why that side has no border or radius. On ultrawide
 * screens (2000 px, 125rem, and up) the homepage gives it a fixed width
 * instead, so it no longer reaches the edge and its right side is closed
 * like the left. The two breakpoints here and the one in app/page.tsx go together.
 */
export function WorkspaceFigure() {
  return (
    <div
      role="img"
      aria-label="The JustResize workspace: a 4032 by 3024 photograph previewed at a smaller output size, with the resize settings beside it."
      className="overflow-hidden rounded-panel border border-line-subtle bg-surface-1 lg:rounded-r-none lg:border-r-0 min-[125rem]:rounded-r-panel min-[125rem]:border-r"
    >
      <div aria-hidden className="grid lg:grid-cols-[minmax(0,1fr)_22.5rem]">
        <div className="min-w-0">
          <div className="flex items-center gap-3 px-3 py-2">
            <p className="min-w-0 flex-1 truncate text-ui font-medium">
              <DemoName />
            </p>
            <Segments options={["Original", "Output"]} active="Output" />
            <div className="hidden sm:block">
              <Segments options={["Fit", "100%"]} active="Fit" />
            </div>
          </div>

          <div className="bg-canvas px-10 pb-8 pt-10 sm:px-14 sm:pb-10 sm:pt-12">
            <DemoFrame>
              <DemoPhotos />
            </DemoFrame>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-xs text-fg-secondary">
            <span className="font-mono">4032 × 3024 JPEG 5.8 MB</span>
            <span className="flex items-center gap-2 font-mono text-fg">
              <ArrowRightIcon width={12} height={12} className="text-fg-tertiary" />
              <DemoSize /> WebP <DemoBytes />
            </span>
            <span>
              <DemoSaving />
            </span>
          </div>
        </div>

        <div className="hidden flex-col border-l border-line-subtle lg:flex lg:pr-10 min-[125rem]:pr-0">
          <div className="flex flex-col gap-3 px-5 py-4">
            <div className="flex items-baseline justify-between">
              <p className="text-ui font-semibold">Resize</p>
              <p className="text-xs text-fg-tertiary">Applies to all 4 images</p>
            </div>
            <Segments options={["Dimensions", "Max size", "Percentage", "File size"]} active="Dimensions" />
            <div className="flex items-end">
              <FigureField label="Width" value={<DemoSize part="width" />} />
              <span className="mx-1 flex h-8 w-7 shrink-0 items-center justify-center rounded-control bg-accent-subtle text-accent-text">
                <LockIcon width={14} height={14} />
              </span>
              <FigureField label="Height" value={<DemoSize part="height" />} />
            </div>
            <p className="flex items-center gap-2 font-mono text-xs text-fg-tertiary">
              4032 × 3024
              <ArrowRightIcon width={12} height={12} />
              <span className="font-medium text-fg">
                <DemoSize />
              </span>
            </p>
          </div>
          <div className="flex flex-col gap-3 border-t border-line-subtle px-5 py-4">
            <p className="text-ui font-semibold">Output</p>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-fg-secondary">Format</p>
              <p className="flex h-8 w-40 items-center rounded-control border border-line bg-surface-2 px-2.5 text-ui">WebP</p>
            </div>
            <div className="flex items-center gap-3">
              <p className="text-xs text-fg-secondary">Quality</p>
              <span className="relative h-0.5 flex-1 rounded-full bg-line-strong">
                <span className="absolute inset-y-0 left-0 w-[82%] rounded-full bg-accent-text" />
                <span className="absolute left-[82%] top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-fg ring-[3px] ring-surface-1" />
              </span>
              <p className="font-mono text-ui">82</p>
            </div>
          </div>
          <div className="mt-auto border-t border-line-subtle px-5 py-4">
            <p className="flex h-10 items-center justify-center rounded-control bg-accent text-sm font-medium text-accent-fg">Resize 4 images</p>
          </div>
        </div>
      </div>
    </div>
  );
}
