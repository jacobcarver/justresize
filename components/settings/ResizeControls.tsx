"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dim } from "@/components/ui/Dim";
import { FieldRow, HelpText, Select } from "@/components/ui/Field";
import { ArrowRightIcon, LockIcon, SwapIcon, UnlockIcon } from "@/components/ui/icons";
import { NumberField } from "@/components/ui/NumberField";
import { Segmented } from "@/components/ui/Segmented";
import { Tooltip } from "@/components/ui/Tooltip";
import { useSelectedContext } from "@/lib/hooks";
import { isBoxed, resolveOutputSize } from "@/lib/image/geometry";
import { ASPECT_RATIO_PRESETS, PERCENTAGE_PRESETS, presetCategories, SIZE_PRESETS } from "@/lib/presets/defaults";
import { FIT_LABELS } from "@/lib/settings/describe";
import { roundPx } from "@/lib/utils/math";
import { useSettingsStore } from "@/stores/useSettingsStore";
import type { ResizeFit, ResizeMode, Size, TransformConfig } from "@/types";
import { TargetSizeFields } from "./TargetSizeFields";

const MODES: { value: ResizeMode; label: string }[] = [
  { value: "dimensions", label: "Dimensions" },
  { value: "max-dimensions", label: "Max size" },
  { value: "percentage", label: "Percentage" },
  { value: "target-filesize", label: "File size" },
];

const FIT_DESCRIPTIONS: Record<ResizeFit, string> = {
  cover: "Fills the frame exactly. Whatever doesn't fit is cropped off.",
  contain: "Keeps the whole image and pads the empty space with a background.",
  inside: "Keeps the whole image with no padding, so one side may come out smaller.",
  stretch: "Forces the exact size. The image will look squashed or stretched.",
};

const FITS: ResizeFit[] = ["cover", "contain", "inside", "stretch"];
const MAX_SIZE_SHORTCUTS = [800, 1080, 1280, 1600, 1920, 2560];

/** What the selected image goes from and to, in the app's dimension notation. */
function SizeReadout({ source, output }: { source: Size | undefined; output: Size | null }) {
  if (!source || !output) return null;
  return (
    <p className="flex items-center gap-2 text-xs text-fg-tertiary">
      <Dim size={source} />
      <ArrowRightIcon width={12} height={12} className="shrink-0" />
      <span className="sr-only">becomes</span>
      <Dim size={output} className="font-medium text-fg" />
    </p>
  );
}

function DimensionsControls({ config, source, output }: { config: TransformConfig; source: Size | undefined; output: Size | null }) {
  const setConfig = useSettingsStore((state) => state.setConfig);
  const locked = config.maintainAspectRatio;
  const matchedRatio = ASPECT_RATIO_PRESETS.find(
    (preset) => preset.ratio && preset.ratio.w === config.aspectRatio?.w && preset.ratio.h === config.aspectRatio?.h,
  );
  // "Custom" has to be remembered separately: a custom 16:9 would otherwise snap back to the 16:9 preset.
  const [customRatio, setCustomRatio] = useState(!!config.aspectRatio && !matchedRatio);
  const ratioValue = !locked ? "free" : !config.aspectRatio ? "original" : customRatio || !matchedRatio ? "custom" : matchedRatio.id;

  /** When locking, one field drives and the other follows; keep width as the driver if it is set. */
  const lockedDimensions = () => ({ height: config.width !== undefined ? undefined : config.height });
  /** When unlocking, pin both fields to what they currently show so nothing jumps. */
  const unlockedDimensions = () => {
    const anySet = config.width !== undefined || config.height !== undefined || !!config.aspectRatio;
    if (!anySet) return {};
    return { width: config.width ?? output?.width, height: config.height ?? output?.height };
  };

  const changeRatio = (value: string) => {
    setCustomRatio(value === "custom");
    if (value === "free") {
      setConfig({ maintainAspectRatio: false, ...unlockedDimensions() });
    } else if (value === "original") {
      setConfig({ maintainAspectRatio: true, aspectRatio: undefined, ...lockedDimensions() });
    } else if (value === "custom") {
      setConfig({ maintainAspectRatio: true, aspectRatio: config.aspectRatio ?? { w: 3, h: 2 }, ...lockedDimensions() });
    } else {
      const preset = ASPECT_RATIO_PRESETS.find((candidate) => candidate.id === value);
      setConfig({ maintainAspectRatio: true, aspectRatio: preset?.ratio, ...lockedDimensions() });
    }
  };

  const swap = () => {
    if (!locked) {
      setConfig({ width: config.height, height: config.width });
      return;
    }
    if (config.aspectRatio) {
      // 16:9 at 1920 wide becomes 9:16 at 1080 wide.
      const { w, h } = config.aspectRatio;
      setConfig({
        aspectRatio: { w: h, h: w },
        width: config.width !== undefined ? roundPx((config.width * h) / w) : undefined,
        height: config.height !== undefined ? roundPx((config.height * w) / h) : undefined,
      });
      return;
    }
    // Locked to the original ratio: a swapped size is a different shape, so it becomes an exact box.
    const width = config.width ?? output?.width;
    const height = config.height ?? output?.height;
    if (width !== undefined && height !== undefined) {
      setConfig({ maintainAspectRatio: false, width: height, height: width });
    } else {
      setConfig({ width: config.height, height: config.width });
    }
  };

  const scale = (factor: number) => {
    const apply = (value: number | undefined) => (value === undefined ? undefined : roundPx(value * factor));
    if (config.width === undefined && config.height === undefined) {
      if (!output) return;
      setConfig(
        locked
          ? { width: apply(output.width) }
          : { width: apply(output.width), height: apply(output.height) },
      );
      return;
    }
    setConfig({ width: apply(config.width), height: apply(config.height) });
  };

  const applySizePreset = (id: string) => {
    const preset = SIZE_PRESETS.find((candidate) => candidate.id === id);
    if (!preset) return;
    setCustomRatio(false);
    setConfig({
      width: preset.width,
      height: preset.height,
      maintainAspectRatio: false,
      aspectRatio: undefined,
      ...(preset.fit ? { fit: preset.fit } : {}),
      ...(preset.format ? { outputFormat: preset.format } : {}),
    });
  };

  const widthInvalid = config.width !== undefined && !(config.width >= 1);
  const heightInvalid = config.height !== undefined && !(config.height >= 1);

  return (
    <div className="flex flex-col gap-3">
      <div>
        {/* Width and height are one control: the lock between them is their relationship. */}
        <div className="flex items-end">
          <NumberField
            id="width"
            label="Width"
            suffix="px"
            placeholder="auto"
            value={config.width}
            derived={output?.width}
            invalid={widthInvalid}
            onChange={(width) => setConfig(locked ? { width, height: undefined } : { width })}
            className="min-w-0 flex-1"
          />
          <Tooltip label="Maintain aspect ratio" className="shrink-0">
            <button
              type="button"
              aria-pressed={locked}
              aria-label="Lock aspect ratio"
              onClick={() =>
                setConfig(
                  locked
                    ? { maintainAspectRatio: false, ...unlockedDimensions() }
                    : { maintainAspectRatio: true, ...lockedDimensions() },
                )
              }
              className={`relative mx-1 flex h-(--control-h) w-7 items-center justify-center rounded-control transition-colors duration-150 before:absolute before:right-full before:top-1/2 before:h-px before:w-1 after:absolute after:left-full after:top-1/2 after:h-px after:w-1 touch:w-10 ${
                locked
                  ? "bg-accent-subtle text-accent-text before:bg-accent-text/60 after:bg-accent-text/60"
                  : "text-fg-tertiary hover:bg-surface-hover hover:text-fg"
              }`}
            >
              {locked ? <LockIcon width={14} height={14} /> : <UnlockIcon width={14} height={14} />}
            </button>
          </Tooltip>
          <NumberField
            id="height"
            label="Height"
            suffix="px"
            placeholder="auto"
            value={config.height}
            derived={output?.height}
            invalid={heightInvalid}
            onChange={(height) => setConfig(locked ? { height, width: undefined } : { height })}
            className="min-w-0 flex-1"
          />
        </div>

        <div className="-mx-1.5 mt-1.5 flex flex-wrap items-center">
          <Button variant="ghost" size="sm" onClick={swap} aria-label="Swap width and height">
            <SwapIcon width={13} height={13} />
            Swap
          </Button>
          <Button variant="ghost" size="sm" onClick={() => scale(0.5)} aria-label="Halve dimensions">
            ½
          </Button>
          <Button variant="ghost" size="sm" onClick={() => scale(2)} aria-label="Double dimensions">
            2×
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Reset to original size"
            onClick={() => {
              setCustomRatio(false);
              setConfig({ width: undefined, height: undefined, aspectRatio: undefined, maintainAspectRatio: true });
            }}
          >
            Reset
          </Button>
        </div>
      </div>

      <SizeReadout source={source} output={output} />

      <div className="mt-1 flex flex-col gap-2">
        <FieldRow label="Aspect ratio" htmlFor="aspect-ratio">
          <Select id="aspect-ratio" value={ratioValue} onChange={(event) => changeRatio(event.target.value)}>
            {ASPECT_RATIO_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
            <option value="custom">Custom…</option>
            <option value="free">Free (unlocked)</option>
          </Select>
        </FieldRow>

        {ratioValue === "custom" && config.aspectRatio && (
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,11.5rem)] items-center gap-3">
            <span className="text-xs text-fg-secondary">Custom ratio</span>
            <div className="flex items-center gap-1.5">
              <NumberField
                id="ratio-w"
                label="Ratio width"
                hideLabel
                decimal
                value={config.aspectRatio.w}
                invalid={!(config.aspectRatio.w > 0)}
                onChange={(w) => setConfig({ aspectRatio: { w: w ?? 0, h: config.aspectRatio!.h } })}
                className="min-w-0 flex-1"
              />
              <span className="font-mono text-fg-tertiary" aria-hidden>
                :
              </span>
              <NumberField
                id="ratio-h"
                label="Ratio height"
                hideLabel
                decimal
                value={config.aspectRatio.h}
                invalid={!(config.aspectRatio.h > 0)}
                onChange={(h) => setConfig({ aspectRatio: { w: config.aspectRatio!.w, h: h ?? 0 } })}
                className="min-w-0 flex-1"
              />
            </div>
          </div>
        )}

        <FieldRow label="Preset" htmlFor="size-preset">
          <Select id="size-preset" value="" onChange={(event) => applySizePreset(event.target.value)}>
            <option value="">Choose…</option>
            {presetCategories().map((category) => (
              <optgroup key={category} label={category}>
                {SIZE_PRESETS.filter((preset) => preset.category === category).map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </FieldRow>
      </div>

      {isBoxed(config) && (
        <div className="mt-1">
          <Segmented
            name="fit"
            legend="Fit"
            value={config.fit}
            options={FITS.map((fit) => ({ value: fit, label: FIT_LABELS[fit], hint: FIT_DESCRIPTIONS[fit] }))}
            onChange={(fit) => setConfig({ fit })}
          />
          <HelpText className="mt-1.5">{FIT_DESCRIPTIONS[config.fit]}</HelpText>
        </div>
      )}
    </div>
  );
}

function MaxDimensionsControls({ config, source, output }: { config: TransformConfig; source: Size | undefined; output: Size | null }) {
  const setConfig = useSettingsStore((state) => state.setConfig);
  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="flex gap-2">
          <NumberField
            id="max-width"
            label="Max width"
            suffix="px"
            placeholder="any"
            value={config.width}
            invalid={config.width !== undefined && !(config.width >= 1)}
            onChange={(width) => setConfig({ width })}
            className="min-w-0 flex-1"
          />
          <NumberField
            id="max-height"
            label="Max height"
            suffix="px"
            placeholder="any"
            value={config.height}
            invalid={config.height !== undefined && !(config.height >= 1)}
            onChange={(height) => setConfig({ height })}
            className="min-w-0 flex-1"
          />
        </div>
        <div className="-mx-1.5 mt-1.5 flex flex-wrap" role="group" aria-label="Common maximum sizes">
          {MAX_SIZE_SHORTCUTS.map((size) => (
            <Button
              key={size}
              variant="ghost"
              size="sm"
              className="font-mono"
              aria-pressed={config.width === size && config.height === size}
              onClick={() => setConfig({ width: size, height: size })}
            >
              {size}
            </Button>
          ))}
        </div>
      </div>
      <SizeReadout source={source} output={output} />
      <HelpText>Images keep their shape and are scaled down to fit inside this box. Smaller images are left as they are.</HelpText>
    </div>
  );
}

function PercentageControls({ config, source, output }: { config: TransformConfig; source: Size | undefined; output: Size | null }) {
  const setConfig = useSettingsStore((state) => state.setConfig);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end gap-2">
        <NumberField
          id="percentage"
          label="Scale"
          suffix="%"
          decimal
          value={config.percentage}
          invalid={config.percentage === undefined || !(config.percentage > 0)}
          onChange={(percentage) => setConfig({ percentage })}
          className="w-24 shrink-0"
        />
        <div className="flex h-(--control-h) flex-wrap items-center" role="group" aria-label="Common percentages">
          {PERCENTAGE_PRESETS.map((percentage) => (
            <Button
              key={percentage}
              variant="ghost"
              size="sm"
              className="font-mono touch:px-2"
              aria-pressed={config.percentage === percentage}
              onClick={() => setConfig({ percentage })}
            >
              {percentage}%
            </Button>
          ))}
        </div>
      </div>
      <SizeReadout source={source} output={output} />
    </div>
  );
}

export function ResizeControls() {
  const globalConfig = useSettingsStore((state) => state.config);
  const setMode = useSettingsStore((state) => state.setMode);
  const { asset } = useSelectedContext();
  // Fields show what the selected image would come out as; without an image there is nothing to derive from.
  const output = asset ? resolveOutputSize(asset, globalConfig) : null;

  return (
    <div className="flex flex-col gap-4">
      <Segmented name="resize-mode" legend="Resize by" value={globalConfig.resizeMode} options={MODES} onChange={setMode} />

      {globalConfig.resizeMode === "dimensions" && <DimensionsControls config={globalConfig} source={asset} output={output} />}
      {globalConfig.resizeMode === "max-dimensions" && <MaxDimensionsControls config={globalConfig} source={asset} output={output} />}
      {globalConfig.resizeMode === "percentage" && <PercentageControls config={globalConfig} source={asset} output={output} />}
      {globalConfig.resizeMode === "target-filesize" && <TargetSizeFields idPrefix="target" label="Make each image smaller than" />}
    </div>
  );
}
