"use client";

import dynamic from "next/dynamic";
import { Spinner } from "@/components/ui/icons";
import type { TransformConfig } from "@/types";

/**
 * The workspace touches File, Blob, canvas, workers and localStorage, none
 * of which exist during server rendering, so it is loaded on the client only.
 * The placeholder has the workspace's shape, so nothing moves when it arrives.
 */
const Workspace = dynamic(() => import("./Workspace").then((module) => module.Workspace), {
  ssr: false,
  loading: () => (
    <div className="mx-auto w-full max-w-[84rem] px-4 py-4 lg:px-6 lg:py-5">
      <div className="empty-stage mx-auto flex w-full max-w-[56rem] items-center justify-center gap-2 rounded-panel bg-surface-1 text-ui text-fg-tertiary" role="status">
        <Spinner /> Loading…
      </div>
    </div>
  ),
});

export function WorkspaceLoader(props: { initialConfig?: Partial<TransformConfig>; presetNote?: string }) {
  return <Workspace {...props} />;
}
