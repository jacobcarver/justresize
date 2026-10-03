"use client";

import type { Ref } from "react";
import { CornerFrame } from "@/components/brand/Mark";
import { Button } from "@/components/ui/Button";
import { PlusIcon } from "@/components/ui/icons";
import { Tooltip } from "@/components/ui/Tooltip";
import { FILE_INPUT_ACCEPT } from "@/lib/image/formats";
import { addFiles } from "@/lib/processing/ingest";
import { formatBytes } from "@/lib/utils/bytes";
import { shortcut } from "@/lib/utils/platform";
import { useAssetStore } from "@/stores/useAssetStore";

/** The one real file input. Everything that adds images clicks this; dropping is handled page-wide by Workspace. */
export function FilePicker({ ref }: { ref: Ref<HTMLInputElement> }) {
  return (
    <input
      ref={ref}
      type="file"
      multiple
      accept={FILE_INPUT_ACCEPT}
      className="sr-only"
      tabIndex={-1}
      aria-hidden
      data-testid="file-input"
      onChange={(event) => {
        if (event.target.files) addFiles(event.target.files);
        // Reset so choosing the same file again still fires a change event.
        event.target.value = "";
      }}
    />
  );
}

const VALUE_PROPS = [
  { title: "Stays on your device", body: "Images are processed in your browser and never uploaded." },
  { title: "Whole batches", body: "Resize hundreds of images at once and download one ZIP." },
  { title: "Exact file sizes", body: "Get every image under 500 KB, or whatever limit you need." },
];

/**
 * The workspace before any image is open: one centred place to put images,
 * and nothing else to look at. The whole frame is one real <button>, so it
 * is reachable and operable from the keyboard.
 */
export function EmptyDropzone({ onPick, note }: { onPick: () => void; note?: string }) {
  return (
    <div className="mx-auto w-full max-w-[56rem]">
      <button
        type="button"
        onClick={onPick}
        className="empty-stage group relative flex w-full flex-col items-center justify-center rounded-panel bg-surface-1 px-6 text-center transition-colors duration-150 hover:bg-surface-2"
      >
        <CornerFrame className="inset-5 group-hover:*:border-accent-text" />
        <span className="text-xl font-medium tracking-[-0.01em] touch:hidden">Drop images here</span>
        <span className="hidden text-xl font-medium tracking-[-0.01em] touch:block">Add images to resize</span>
        <span className="mt-4 inline-flex h-9 items-center rounded-control bg-accent px-4 text-sm font-medium text-accent-fg transition-colors duration-150 group-hover:bg-accent-hover touch:h-11 touch:px-5 touch:text-base">
          Choose images
        </span>
        <span className="mt-4 text-xs text-fg-tertiary">
          JPEG, PNG, WebP or AVIF. Processed on your device.
          <span className="touch:hidden"> Pasting an image works too.</span>
        </span>
        {note && <span className="mt-1 text-xs text-fg-secondary">{note}</span>}
      </button>

      <ul className="mt-6 grid gap-x-8 gap-y-4 px-1 sm:grid-cols-3">
        {VALUE_PROPS.map((item) => (
          <li key={item.title}>
            <p className="text-ui font-medium text-fg">{item.title}</p>
            <p className="mt-0.5 text-ui text-fg-tertiary">{item.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Once images are open the uploader collapses to this bar: one button and what is loaded. */
export function AddBar({ onPick }: { onPick: () => void }) {
  const count = useAssetStore((state) => state.assets.length);
  const bytes = useAssetStore((state) => state.assets.reduce((sum, asset) => sum + asset.fileSize, 0));

  return (
    <div className="flex items-center gap-3">
      <Tooltip label={shortcut("O")} side="bottom" align="start">
        <Button onClick={onPick}>
          <PlusIcon />
          Add images
        </Button>
      </Tooltip>
      <p className="flex min-w-0 items-baseline gap-2 text-ui text-fg-secondary">
        <span>
          {count.toLocaleString("en-US")} {count === 1 ? "image" : "images"}
        </span>
        <span className="font-mono text-xs text-fg-tertiary">{formatBytes(bytes)}</span>
      </p>
    </div>
  );
}
