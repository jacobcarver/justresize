"use client";

import { Checkbox, FieldLabel, FieldRow, HelpText, Select } from "@/components/ui/Field";
import { NumberField } from "@/components/ui/NumberField";
import { Segmented } from "@/components/ui/Segmented";
import { Slider } from "@/components/ui/Slider";
import { useCapabilities, useSelectedContext } from "@/lib/hooks";
import { availableOutputFormats, OUTPUT_FORMATS, resolveOutputFormat } from "@/lib/image/formats";
import { isBoxed } from "@/lib/image/geometry";
import { qualityIsAutomatic } from "@/lib/settings/describe";
import { clamp } from "@/lib/utils/math";
import { useSettingsStore } from "@/stores/useSettingsStore";
import type { OutputFormat, OutputFormatSetting } from "@/types";
import { TargetSizeFields } from "./TargetSizeFields";

type BackgroundChoice = "transparent" | "white" | "black" | "custom";

/** One short line about a format, shown only when that format has been picked explicitly. */
const FORMAT_HINTS: Partial<Record<OutputFormat, string>> = {
  jpeg: "Best for photographs. No transparency.",
  webp: "Smaller files than JPEG, and keeps transparency.",
  avif: "The smallest files. Slower to create.",
};

export function OutputControls() {
  const config = useSettingsStore((state) => state.config);
  const setConfig = useSettingsStore((state) => state.setConfig);
  const setTarget = useSettingsStore((state) => state.setTarget);
  const lastTarget = useSettingsStore((state) => state.ui.lastTarget);
  const capabilities = useCapabilities();
  const { asset } = useSelectedContext();

  const formats = availableOutputFormats(capabilities);
  const explicitFormat = config.outputFormat === "source" ? null : config.outputFormat;
  const resolvedFormat = asset ? resolveOutputFormat(config.outputFormat, asset, capabilities) : explicitFormat;

  // With "same as original" a batch can mix formats, so quality stays
  // available unless we know for certain the output is lossless.
  const lossy = resolvedFormat ? OUTPUT_FORMATS[resolvedFormat].lossy : true;
  const automaticQuality = qualityIsAutomatic(config);
  const qualityPercent = Math.round(config.quality * 100);

  const flattens = resolvedFormat ? !OUTPUT_FORMATS[resolvedFormat].supportsTransparency : false;
  const padding = isBoxed(config) && config.fit === "contain";
  // Flattening only matters when there is transparency to flatten; with no
  // image selected yet we cannot know, so the control stays available.
  const needsFill = flattens && (asset ? !!asset.hasTransparency : true);
  const showBackground = padding || needsFill || config.background.type === "color";

  const color = config.background.color.toLowerCase();
  const backgroundChoice: BackgroundChoice =
    config.background.type === "transparent"
      ? flattens
        ? "white"
        : "transparent"
      : color === "#ffffff"
        ? "white"
        : color === "#000000"
          ? "black"
          : "custom";

  const changeBackground = (choice: BackgroundChoice) => {
    switch (choice) {
      case "transparent":
        setConfig({ background: { type: "transparent", color: "#ffffff" } });
        break;
      case "white":
        setConfig({ background: { type: "color", color: "#ffffff" } });
        break;
      case "black":
        setConfig({ background: { type: "color", color: "#000000" } });
        break;
      case "custom":
        setConfig({ background: { type: "color", color: backgroundChoice === "custom" ? color : "#d4d4d8" } });
        break;
    }
  };

  const backgroundOptions: { value: BackgroundChoice; label: string }[] = [
    ...(flattens ? [] : [{ value: "transparent" as const, label: "Transparent" }]),
    { value: "white", label: "White" },
    { value: "black", label: "Black" },
    { value: "custom", label: "Custom" },
  ];

  const formatNote =
    config.outputFormat === "source" && asset && resolvedFormat && resolvedFormat !== asset.format
      ? `This image can't be saved in its original format here, so it will become ${OUTPUT_FORMATS[resolvedFormat].label}.`
      : explicitFormat
        ? FORMAT_HINTS[explicitFormat]
        : undefined;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <FieldRow label="Format" htmlFor="output-format">
          <Select
            id="output-format"
            value={config.outputFormat}
            onChange={(event) => setConfig({ outputFormat: event.target.value as OutputFormatSetting })}
          >
            <option value="source">Same as original</option>
            {formats.map((format) => (
              <option key={format} value={format}>
                {OUTPUT_FORMATS[format].label}
                {format === "avif" && !capabilities.avifEncode ? " (slower)" : ""}
              </option>
            ))}
          </Select>
        </FieldRow>
        {formatNote && <HelpText className="mt-1.5">{formatNote}</HelpText>}
      </div>

      {lossy ? (
        automaticQuality ? (
          <HelpText>Quality is chosen automatically: the highest that fits your file size.</HelpText>
        ) : (
          <div className="grid grid-cols-[auto_minmax(0,1fr)_3.5rem] items-center gap-x-3">
            <FieldLabel htmlFor="quality">Quality</FieldLabel>
            <Slider
              id="quality"
              min={1}
              max={100}
              step={1}
              value={qualityPercent}
              onChange={(event) => setConfig({ quality: Number(event.target.value) / 100 })}
            />
            <NumberField
              id="quality-value"
              label="Quality value"
              hideLabel
              value={qualityPercent}
              onChange={(value) => {
                if (value !== undefined) setConfig({ quality: clamp(Math.round(value), 1, 100) / 100 });
              }}
            />
            <div className="col-start-2 flex justify-between text-2xs text-fg-tertiary" aria-hidden>
              <span>Smaller file</span>
              <span>Better quality</span>
            </div>
          </div>
        )
      ) : (
        <HelpText>
          PNG is lossless, so there is no quality setting.
          {config.targetFileSize && config.targetFileSize.strategy !== "dimensions"
            ? " To get under a file-size limit, colours are reduced before dimensions."
            : ""}
        </HelpText>
      )}

      {config.resizeMode !== "target-filesize" && (
        <div>
          <Checkbox
            label="Limit file size"
            checked={!!config.targetFileSize}
            onChange={(event) => setTarget(event.target.checked ? lastTarget : undefined)}
          />
          {config.targetFileSize && (
            <div className="mt-2">
              <TargetSizeFields idPrefix="limit" label="Keep each file under" />
            </div>
          )}
        </div>
      )}

      {showBackground && (
        <div>
          <div className="flex items-end gap-2">
            <Segmented
              name="background"
              legend="Background"
              value={backgroundChoice}
              options={backgroundOptions}
              onChange={changeBackground}
              className="flex-1"
            />
            {backgroundChoice === "custom" && (
              <div className="shrink-0">
                <label htmlFor="background-color" className="sr-only">
                  Background colour
                </label>
                <input
                  id="background-color"
                  type="color"
                  value={color}
                  onChange={(event) => setConfig({ background: { type: "color", color: event.target.value } })}
                  className="block size-(--control-h) cursor-pointer rounded-control border border-line bg-surface-2 p-0.5"
                />
              </div>
            )}
          </div>
          {flattens && (
            <HelpText className="mt-1.5">
              {resolvedFormat ? OUTPUT_FORMATS[resolvedFormat].label : "This format"} can&apos;t be transparent, so see-through
              areas are filled with this colour.
            </HelpText>
          )}
        </div>
      )}
    </div>
  );
}
