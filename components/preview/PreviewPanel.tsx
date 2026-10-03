"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dim } from "@/components/ui/Dim";
import { DimensionLines } from "@/components/ui/DimensionLines";
import { Slider } from "@/components/ui/Slider";
import { AlertIcon, ArrowRightIcon, CheckIcon, CropIcon, Spinner } from "@/components/ui/icons";
import { Segmented } from "@/components/ui/Segmented";
import { useCapabilities, useSelectedAsset, useSelectedContext } from "@/lib/hooks";
import { OUTPUT_FORMATS, SOURCE_FORMATS } from "@/lib/image/formats";
import { computeRenderPlan, focalPointFromCrop, isBoxed, MAX_ZOOM, sizeOf } from "@/lib/image/geometry";
import { resolveBackground } from "@/lib/image/transparency";
import { getPreview } from "@/lib/processing/previews";
import type { PreviewResult } from "@/lib/processing/protocol";
import { getResultBlob } from "@/lib/processing/queue";
import { sameConfig } from "@/lib/settings/compare";
import { describeQuality } from "@/lib/settings/describe";
import { summarizeOutput, validateForSource } from "@/lib/settings/validate";
import { formatBytes, formatSizeChange } from "@/lib/utils/bytes";
import { clamp } from "@/lib/utils/math";
import { isTextEntry } from "@/lib/utils/platform";
import { useAssetStore } from "@/stores/useAssetStore";
import { DEFAULT_SLOT, useProcessingStore } from "@/stores/useProcessingStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import type { CropSettings, ProcessedImageMeta, Rect, Size, SourceImage, TransformConfig } from "@/types";

/** Tiny outputs are shown enlarged to at least this size so they can still be seen and dragged. */
const MIN_PREVIEW_EDGE = 240;
/** Space kept around the image inside the stage; the dimension lines live in it. */
const STAGE_PADDING = 36;
/** Canvas backing stores stay a sane size even at 100% on a very large output. */
const MAX_CANVAS_EDGE = 4096;

type View = "original" | "output";
type Zoom = "fit" | "actual";

const VIEWS: { value: View; label: string; hint: string }[] = [
  { value: "original", label: "Original", hint: "Show the original (O)" },
  { value: "output", label: "Output", hint: "Show the result (R)" },
];

const ZOOMS: { value: Zoom; label: string; hint: string }[] = [
  { value: "fit", label: "Fit", hint: "Fit the image in the window" },
  { value: "actual", label: "100%", hint: "Actual pixels" },
];

const POSITIONS: { label: string; x: number; y: number }[] = [
  { label: "Top left", x: 0, y: 0 },
  { label: "Top", x: 0.5, y: 0 },
  { label: "Top right", x: 1, y: 0 },
  { label: "Left", x: 0, y: 0.5 },
  { label: "Center", x: 0.5, y: 0.5 },
  { label: "Right", x: 1, y: 0.5 },
  { label: "Bottom left", x: 0, y: 1 },
  { label: "Bottom", x: 0.5, y: 1 },
  { label: "Bottom right", x: 1, y: 1 },
];

function setCropOverride(assetId: string, crop: CropSettings | undefined): void {
  const store = useAssetStore.getState();
  const asset = store.assets.find((candidate) => candidate.id === assetId);
  if (!asset) return;
  const overrides = { ...asset.overrides };
  if (crop) overrides.crop = crop;
  else delete overrides.crop;
  store.setOverrides(assetId, Object.keys(overrides).length > 0 ? overrides : undefined);
}

function applyCropToAll(crop: CropSettings): void {
  useSettingsStore.getState().setConfig({ crop });
  const store = useAssetStore.getState();
  for (const asset of store.assets) {
    if (asset.overrides?.crop) setCropOverride(asset.id, undefined);
  }
}

function useElementSize<T extends HTMLElement>(): [React.RefObject<T | null>, Size] {
  const ref = useRef<T>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({ width: Math.floor(entry.contentRect.width), height: Math.floor(entry.contentRect.height) }),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, size];
}

/** The finished result for this image, but only if it was made with the settings now on screen. */
function useCurrentResult(asset: SourceImage, config: TransformConfig): { jobId: string; result: ProcessedImageMeta } | null {
  const job = useProcessingStore((state) => state.jobs[asset.id]?.[DEFAULT_SLOT]);
  if (!job || job.state.status !== "complete" || !sameConfig(job.configuration, config)) return null;
  return { jobId: job.id, result: job.state.result };
}

/**
 * An object URL for a result Blob, handed out once the browser has decoded
 * it. The URL is revoked as soon as the result is replaced, goes out of
 * date or the preview unmounts, so the preview never keeps a Blob alive.
 */
function useResultUrl(jobId: string | null): string | null {
  const [loaded, setLoaded] = useState<{ jobId: string; url: string } | null>(null);
  useEffect(() => {
    if (!jobId) return;
    const blob = getResultBlob(jobId);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    let active = true;
    const image = new Image();
    image.onload = () => {
      if (active) setLoaded({ jobId, url });
    };
    image.src = url;
    return () => {
      active = false;
      image.onload = null;
      URL.revokeObjectURL(url);
    };
  }, [jobId]);
  return loaded && loaded.jobId === jobId ? loaded.url : null;
}

interface PreviewBodyProps {
  asset: SourceImage;
  config: TransformConfig;
  view: View;
  zoom: Zoom;
  onView: (view: View) => void;
  onZoom: (zoom: Zoom) => void;
}

function PreviewBody({ asset, config, view, zoom, onView, onZoom }: PreviewBodyProps) {
  const capabilities = useCapabilities();
  const assetCount = useAssetStore((state) => state.assets.length);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [failed, setFailed] = useState(false);
  const [stageRef, stage] = useElementSize<HTMLDivElement>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ pointerId: number; startX: number; startY: number; crop: Rect } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPreview(asset)
      .then((result) => {
        if (!cancelled) setPreview(result);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [asset]);

  // The same plan the export engine computes — the preview cannot drift from the result.
  const plan = useMemo(() => computeRenderPlan(asset, config), [asset, config]);
  const summary = useMemo(() => summarizeOutput(asset, config, capabilities), [asset, config, capabilities]);
  const background = resolveBackground(config.background, summary.format);
  const sizeProblem = validateForSource(asset, config);

  // Once this image has been resized with the settings on screen, "Output"
  // shows the real file instead of a simulation of it.
  const current = useCurrentResult(asset, config);
  const resultUrl = useResultUrl(view === "output" && current ? current.jobId : null);
  const result = resultUrl && current ? current.result : null;

  const original = view === "original";
  const interactive = !original && isBoxed(config) && config.fit === "cover";
  const slackX = asset.width - plan.src.width > 0.5;
  const slackY = asset.height - plan.src.height > 0.5;
  const draggable = interactive && (slackX || slackY);
  const hasOwnCrop = !!asset.overrides?.crop;

  /** What the canvas draws: the planned output, or the untouched source. */
  const drawn = useMemo(() => {
    if (!original) return plan;
    const full = { x: 0, y: 0, width: asset.width, height: asset.height };
    return { canvas: sizeOf(asset), src: full, dst: full };
  }, [original, plan, asset]);

  /** Pixel size of what is on show, which is what 100% and the dimension lines refer to. */
  const natural: Size = result ? { width: result.width, height: result.height } : drawn.canvas;

  const display = useMemo(() => {
    const { width, height } = natural;
    if (stage.width <= 0 || stage.height <= 0) return { width: 0, height: 0 };
    if (zoom === "actual") return { width, height };
    const room = { width: stage.width - STAGE_PADDING * 2, height: stage.height - STAGE_PADDING * 2 };
    let scale = Math.min(room.width / width, room.height / height);
    if (scale > 1) scale = Math.min(scale, Math.max(1, MIN_PREVIEW_EDGE / Math.max(width, height)));
    return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- natural is a fresh object each render; its two numbers are the dependencies.
  }, [natural.width, natural.height, stage.width, stage.height, zoom]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !preview || display.width === 0) return;
    const density = Math.min(2, window.devicePixelRatio || 1, MAX_CANVAS_EDGE / Math.max(display.width, display.height));
    canvas.width = Math.max(1, Math.round(display.width * density));
    canvas.height = Math.max(1, Math.round(display.height * density));
    const context = canvas.getContext("2d");
    if (!context) return;

    const scaleX = canvas.width / drawn.canvas.width;
    const scaleY = canvas.height / drawn.canvas.height;
    // The preview bitmap is a downscaled copy; map source coordinates onto it.
    const sourceX = preview.width / asset.width;
    const sourceY = preview.height / asset.height;

    context.clearRect(0, 0, canvas.width, canvas.height);
    if (background && !original) {
      context.fillStyle = background;
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    try {
      context.drawImage(
        preview.image,
        drawn.src.x * sourceX,
        drawn.src.y * sourceY,
        drawn.src.width * sourceX,
        drawn.src.height * sourceY,
        drawn.dst.x * scaleX,
        drawn.dst.y * scaleY,
        drawn.dst.width * scaleX,
        drawn.dst.height * scaleY,
      );
    } catch {
      // The bitmap was released (image removed) between render and draw.
    }
  }, [preview, drawn, background, original, display, asset.width, asset.height]);

  /** Moves the crop window to a new top-left corner (source pixels). */
  const moveCropTo = useCallback(
    (x: number, y: number, size: { width: number; height: number }) => {
      const rect = {
        x: clamp(x, 0, asset.width - size.width),
        y: clamp(y, 0, asset.height - size.height),
        width: size.width,
        height: size.height,
      };
      const focal = focalPointFromCrop(asset, rect);
      setCropOverride(asset.id, { x: focal.x, y: focal.y, zoom: config.crop.zoom });
    },
    [asset, config.crop.zoom],
  );

  const setCropZoom = useCallback(
    (value: number) => {
      // Zoom around what is currently centred, not around a stale focal point.
      const focal = focalPointFromCrop(asset, plan.src);
      setCropOverride(asset.id, { x: focal.x, y: focal.y, zoom: clamp(value, 1, MAX_ZOOM) });
    },
    [asset, plan.src],
  );

  // Ctrl/⌘ + wheel (which is also what a trackpad pinch sends) zooms the crop.
  // Plain scrolling is left alone so the page still scrolls over the preview.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !interactive) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      setCropZoom(config.crop.zoom * Math.exp(-event.deltaY * 0.01));
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [interactive, setCropZoom, config.crop.zoom]);

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!draggable || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, crop: plan.src };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    // Dragging the image right reveals what was to the left, so the crop window moves the other way.
    const sourcePerPixel = active.crop.width / display.width;
    moveCropTo(
      active.crop.x - (event.clientX - active.startX) * sourcePerPixel,
      active.crop.y - (event.clientY - active.startY) * sourcePerPixel,
      active.crop,
    );
  };

  const endDrag = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (drag.current?.pointerId === event.pointerId) drag.current = null;
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLCanvasElement>) => {
    if (!interactive) return;
    const step = (event.shiftKey ? 0.1 : 0.02) * Math.max(asset.width, asset.height);
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      moveCropTo(plan.src.x + move[0], plan.src.y + move[1], plan.src);
    } else if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      setCropZoom(config.crop.zoom * 1.1);
    } else if (event.key === "-") {
      event.preventDefault();
      setCropZoom(config.crop.zoom / 1.1);
    }
  };

  // Let the page scroll along any axis the crop cannot move in, so a swipe
  // over the preview is not swallowed on phones.
  const touchAction = !draggable ? "auto" : slackX && slackY ? "none" : slackX ? "pan-y" : "pan-x";

  const quality = describeQuality(config, summary.format);
  const outputSize = result ? { width: result.width, height: result.height } : summary.size;
  const outputFormat = result ? result.format : summary.format;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <section className="min-w-0 overflow-hidden rounded-panel bg-surface-1" aria-label="Preview">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2">
          <p className="flex min-w-0 flex-1 basis-full items-center gap-2 text-ui font-medium sm:basis-0" title={asset.originalName}>
            <span className="truncate">{asset.originalName}</span>
            {hasOwnCrop && (
              <span className="flex shrink-0 items-center gap-1 text-xs font-normal text-fg-tertiary">
                <CropIcon width={12} height={12} />
                Own crop
              </span>
            )}
          </p>
          <Segmented name="preview-view" legend="Show" hideLegend size="sm" value={view} options={VIEWS} onChange={onView} />
          <Segmented name="preview-zoom" legend="Zoom" hideLegend size="sm" value={zoom} options={ZOOMS} onChange={onZoom} />
        </div>

        <div
          ref={stageRef}
          className={`stage thin-scrollbar bg-canvas ${zoom === "actual" ? "overflow-auto" : "overflow-hidden"}`}
        >
          {failed ? (
            <p className="flex h-full items-center justify-center gap-2 p-6 text-ui text-fg-secondary">
              <AlertIcon className="shrink-0 text-danger" />
              The preview couldn&apos;t be created for this image.
            </p>
          ) : !preview ? (
            <p className="flex h-full items-center justify-center gap-2 p-6 text-ui text-fg-tertiary" role="status">
              <Spinner /> Preparing preview…
            </p>
          ) : (
            <div className="grid min-h-full w-max min-w-full place-items-center" style={{ padding: STAGE_PADDING }}>
              <div className="relative" style={{ width: display.width, height: display.height }}>
                {display.width > 0 && <DimensionLines size={natural} />}
                <div className="checkerboard relative size-full">
                  <canvas
                    ref={canvasRef}
                    data-testid="preview-canvas"
                    className={`block size-full ${result ? "opacity-0" : ""} ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`}
                    style={{ touchAction }}
                    tabIndex={interactive ? 0 : -1}
                    role={interactive ? "application" : "img"}
                    aria-label={
                      interactive
                        ? "Crop preview. Drag, or use the arrow keys, to choose which part of the image is kept. Plus and minus zoom."
                        : original
                          ? `Original image, ${asset.width} by ${asset.height} pixels`
                          : `Preview of the output, ${outputSize.width} by ${outputSize.height} pixels`
                    }
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                    onKeyDown={onKeyDown}
                  />
                  {result && resultUrl && (
                    // The real output file, straight from its Blob; next/image has nothing to optimise here.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={resultUrl} alt="" draggable={false} className="pointer-events-none absolute inset-0 size-full select-none" />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {interactive && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line-subtle px-3 py-2">
            <fieldset>
              <legend className="sr-only">Crop position</legend>
              <div className="grid grid-cols-3 gap-px">
                {POSITIONS.map((position) => {
                  const active = Math.abs(config.crop.x - position.x) < 0.001 && Math.abs(config.crop.y - position.y) < 0.001;
                  return (
                    <button
                      key={position.label}
                      type="button"
                      title={position.label}
                      aria-label={`Crop position: ${position.label}`}
                      aria-pressed={active}
                      onClick={() => setCropOverride(asset.id, { x: position.x, y: position.y, zoom: config.crop.zoom })}
                      className="group flex size-4 items-center justify-center rounded-[3px] hover:bg-surface-hover touch:size-7"
                    >
                      <span
                        className={`size-1 rounded-full touch:size-1.5 ${active ? "bg-accent-text" : "bg-fg-tertiary group-hover:bg-fg"}`}
                        aria-hidden
                      />
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="flex min-w-40 max-w-80 flex-1 items-center gap-2.5">
              <label htmlFor="crop-zoom" className="text-xs text-fg-secondary">
                Crop zoom
              </label>
              <Slider
                id="crop-zoom"
                min={1}
                max={MAX_ZOOM}
                step={0.05}
                value={config.crop.zoom}
                onChange={(event) => setCropZoom(Number(event.target.value))}
                className="min-w-0 flex-1"
              />
              <span className="w-10 font-mono text-xs tabular-nums text-fg-secondary">{config.crop.zoom.toFixed(2)}×</span>
            </div>

            <div className="ml-auto flex gap-1">
              <Button variant="ghost" size="sm" disabled={!hasOwnCrop} onClick={() => setCropOverride(asset.id, undefined)}>
                Reset crop
              </Button>
              {assetCount > 1 && (
                <Button variant="ghost" size="sm" onClick={() => applyCropToAll(config.crop)}>
                  Apply crop to all
                </Button>
              )}
            </div>
            <p className="basis-full text-xs text-fg-tertiary">Drag the image to choose what stays in the frame.</p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-xs text-fg-secondary" data-testid="output-summary">
          <span className="flex items-center gap-2 font-mono">
            <Dim size={asset} /> <span>{asset.format ? SOURCE_FORMATS[asset.format].label : ""}</span>{" "}
            <span>{formatBytes(asset.fileSize)}</span>
          </span>
          {/* The arrow leads the output, so the two never end up on different lines. */}
          <span className="sr-only"> becomes </span>
          <span className="flex items-center gap-2 font-mono text-fg">
            <ArrowRightIcon width={12} height={12} className="mr-1 shrink-0 text-fg-tertiary" />
            <Dim size={outputSize} className="font-medium" /> <span>{OUTPUT_FORMATS[outputFormat].label}</span>
            {result && (
              <>
                {" "}
                <span>{formatBytes(result.fileSize)}</span>
              </>
            )}
          </span>
          {result ? (
            <span className="flex items-center gap-1.5">
              <span>{formatSizeChange(asset.fileSize, result.fileSize)}</span>
              <span className="flex items-center gap-1 text-fg-tertiary">
                <CheckIcon width={12} height={12} className="text-success" />
                Showing the resized file
              </span>
            </span>
          ) : (
            <>
              {quality && <span>{quality}</span>}
              {config.targetFileSize && <span>under {formatBytes(config.targetFileSize.bytes)}</span>}
            </>
          )}
        </div>
      </section>

      {(sizeProblem || summary.warnings.length > 0) && (
        <ul className="flex flex-col gap-1 px-1 text-ui text-fg-secondary">
          {sizeProblem && (
            <li className="flex items-start gap-2 text-danger" role="alert">
              <AlertIcon className="mt-0.5 shrink-0" />
              {sizeProblem}
            </li>
          )}
          {summary.warnings.map((warning) => (
            <li key={warning} className="flex items-start gap-2">
              <AlertIcon className="mt-0.5 shrink-0 text-warning" />
              {warning}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PreviewPanel() {
  const selected = useSelectedAsset();
  const { asset, config } = useSelectedContext();
  // Kept here rather than per image, so stepping through a batch keeps the same view.
  const [view, setView] = useState<View>("output");
  const [zoom, setZoom] = useState<Zoom>("fit");

  // O and R flip between the original and the result, for comparing by eye.
  // Bare keys, so they are ignored wherever typing means entering text.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.repeat || isTextEntry(event.target)) return;
      const key = event.key.toLowerCase();
      if (key === "o") setView("original");
      else if (key === "r") setView("output");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (!asset) {
    return (
      <section className="stage flex items-center justify-center rounded-panel bg-surface-1 p-6 text-ui text-fg-tertiary" aria-label="Preview">
        {selected?.status === "loading" ? (
          <span className="flex items-center gap-2" role="status">
            <Spinner /> Reading image…
          </span>
        ) : (
          "Select an image to preview it."
        )}
      </section>
    );
  }

  // Keyed by image so preview state never leaks from one image to the next.
  return <PreviewBody key={asset.id} asset={asset} config={config} view={view} zoom={zoom} onView={setView} onZoom={setZoom} />;
}
