"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AssetList } from "@/components/assets/AssetList";
import { CornerFrame } from "@/components/brand/Mark";
import { DebugPanel } from "@/components/debug/DebugPanel";
import { ActionBar } from "@/components/jobs/ActionBar";
import { PreviewPanel } from "@/components/preview/PreviewPanel";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { AlertIcon } from "@/components/ui/icons";
import { AddBar, EmptyDropzone, FilePicker } from "@/components/uploader/Dropzone";
import { track } from "@/lib/analytics";
import { DEBUG, FEATURES } from "@/lib/config/features";
import { dragHasFiles, filesFromDataTransfer } from "@/lib/files/drop";
import { takeStashedFiles } from "@/lib/files/handoff";
import { addFiles } from "@/lib/processing/ingest";
import { isCompatibilityMode } from "@/lib/processing/runtime";
import { parseQueryConfig } from "@/lib/settings/query";
import { naturalUnit } from "@/lib/utils/bytes";
import { useAssetStore } from "@/stores/useAssetStore";
import { usePresetStore } from "@/stores/usePresetStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import type { TransformConfig } from "@/types";

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/** Page-wide drag and drop. Returns whether a file drag is currently over the window. */
function useWindowFileDrop(): boolean {
  const [dragging, setDragging] = useState(false);
  // dragenter/dragleave fire for every child element the pointer crosses.
  // Counting them (instead of toggling) is what stops the overlay flickering.
  const depth = useRef(0);

  useEffect(() => {
    const onEnter = (event: DragEvent) => {
      if (!dragHasFiles(event)) return;
      event.preventDefault();
      depth.current += 1;
      setDragging(true);
    };
    const onOver = (event: DragEvent) => {
      if (!dragHasFiles(event)) return;
      // Without this the browser navigates away to display the dropped image.
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    };
    const onLeave = (event: DragEvent) => {
      if (!dragHasFiles(event)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setDragging(false);
    };
    const onDrop = (event: DragEvent) => {
      if (!dragHasFiles(event) || !event.dataTransfer) return;
      event.preventDefault();
      depth.current = 0;
      setDragging(false);
      void filesFromDataTransfer(event.dataTransfer).then(addFiles);
    };

    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

  return dragging;
}

function useClipboardPaste(): void {
  useEffect(() => {
    if (!FEATURES.clipboardPaste) return;
    const onPaste = (event: ClipboardEvent) => {
      // Never hijack a paste into a text field.
      if (isEditable(event.target)) return;
      const files = Array.from(event.clipboardData?.files ?? []).filter((file) => file.type.startsWith("image/"));
      if (files.length === 0) return;
      event.preventDefault();
      addFiles(files);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, []);
}

/** Applies tool-page defaults, then URL parameters (which win), once per page load. */
function useInitialConfig(initialConfig: Partial<TransformConfig> | undefined): void {
  const applied = useRef(false);
  useEffect(() => {
    if (applied.current) return;
    applied.current = true;

    const settings = useSettingsStore.getState();
    const fromQuery = parseQueryConfig(new URLSearchParams(window.location.search));
    const patch = { ...initialConfig, ...fromQuery };
    if (Object.keys(patch).length === 0) return;

    if (patch.resizeMode) settings.setMode(patch.resizeMode);
    const { targetFileSize, ...rest } = patch;
    settings.setConfig(rest);
    if (targetFileSize) {
      settings.setTarget(targetFileSize);
      // Show the target in the unit it reads naturally in: "500 KB", not "0.49 MB".
      settings.setUi({ sizeUnit: naturalUnit(targetFileSize.bytes) });
    }
  }, [initialConfig]);
}

interface WorkspaceProps {
  initialConfig?: Partial<TransformConfig>;
  /** Tool pages say what they have set up, since the settings are not on screen until images are open. */
  presetNote?: string;
}

export function Workspace({ initialConfig, presetNote }: WorkspaceProps) {
  const hasAssets = useAssetStore((state) => state.assets.length > 0);
  const notice = useAssetStore((state) => state.notice);
  const dragging = useWindowFileDrop();
  const pickerRef = useRef<HTMLInputElement>(null);
  const pick = useCallback(() => pickerRef.current?.click(), []);
  useClipboardPaste();
  useInitialConfig(initialConfig);

  useEffect(() => {
    void usePresetStore.getState().load();
    track({ name: "tool_opened", entry: window.location.pathname === "/app" ? "app" : "tool-page" });
    // Images dropped on the homepage arrive here with the navigation.
    const stashed = takeStashedFiles();
    if (stashed.length > 0) addFiles(stashed);
  }, []);

  // Ctrl/⌘ + O opens the file picker, the way it opens a file in any desktop app.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "o" || !(event.metaKey || event.ctrlKey) || event.shiftKey || event.altKey) return;
      event.preventDefault();
      if (!event.repeat) pick();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pick]);

  return (
    <>
      {/*
        Before any image is open there is one thing to do, so the page is just
        the place to do it. Once images exist the full workspace takes over.

        Reading order is the phone layout: images in, preview, settings, then
        the file list — with 50 images open, nobody should have to scroll past
        all of them to reach the controls. On wide screens the settings leave
        the flow and dock to the right edge as a full-height inspector.
      */}
      <div className="mx-auto flex w-full max-w-[84rem] flex-col gap-4 px-4 py-4 lg:px-6 lg:py-5">
        <FilePicker ref={pickerRef} />
        {hasAssets && <AddBar onPick={pick} />}
        {isCompatibilityMode() && <Note>Your browser uses compatibility processing, which may be slower.</Note>}
        {notice && <Note role="status">{notice}</Note>}

        {hasAssets ? (
          <>
            <PreviewPanel />
            {/* .inspector-dock is what makes the page leave room for the docked column (see globals.css). */}
            <aside
              className="inspector-dock flex min-w-0 flex-col border-t border-line-subtle lg:fixed lg:bottom-0 lg:right-0 lg:top-(--header-h) lg:w-(--inspector-w) lg:border-l lg:border-t-0 lg:bg-surface-1"
              aria-label="Resize settings"
            >
              <div className="thin-scrollbar lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
                <SettingsPanel />
              </div>
              <ActionBar />
            </aside>
            <AssetList />
          </>
        ) : (
          <EmptyDropzone onPick={pick} note={presetNote} />
        )}
        {DEBUG && <DebugPanel />}
      </div>

      {/* A veil over the workspace, not a dialog: the page stays visible underneath. */}
      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-50 bg-background/75" aria-hidden>
          <div className="absolute inset-3 flex items-center justify-center sm:inset-5">
            <CornerFrame className="inset-0 *:border-accent-text" />
            <p className="rounded-control bg-surface-2 px-3 py-1.5 text-ui font-medium text-fg">Drop images to add</p>
          </div>
        </div>
      )}
    </>
  );
}

function Note({ children, role = "note" }: { children: React.ReactNode; role?: "note" | "status" }) {
  return (
    <p className="flex items-start gap-2 text-ui text-fg-secondary" role={role}>
      <AlertIcon className="mt-0.5 shrink-0 text-warning" />
      {children}
    </p>
  );
}
