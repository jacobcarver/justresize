"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CornerFrame } from "@/components/brand/Mark";
import { dragHasFiles, filesFromDataTransfer } from "@/lib/files/drop";
import { stashFiles } from "@/lib/files/handoff";

/**
 * Lets images be dropped anywhere on the homepage. They are handed to the
 * workspace in memory and the page moves to /app — nothing is uploaded, and
 * if the hand-off ever fails the visitor simply lands in the empty tool.
 */
export function HomeDrop() {
  const router = useRouter();
  const [dragging, setDragging] = useState(false);
  // dragenter/dragleave fire for every element the pointer crosses; counting them stops the veil flickering.
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
      void filesFromDataTransfer(event.dataTransfer).then((files) => {
        stashFiles(files);
        router.push("/app");
      });
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
  }, [router]);

  if (!dragging) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-50 bg-background/75" aria-hidden>
      <div className="absolute inset-3 flex items-center justify-center sm:inset-5">
        <CornerFrame className="inset-0 *:border-accent-text" />
        <p className="rounded-control bg-surface-2 px-3 py-1.5 text-ui font-medium text-fg">Drop images to open them in JustResize</p>
      </div>
    </div>
  );
}
