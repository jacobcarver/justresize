"use client";

import { useState } from "react";
import { Button, IconButton } from "@/components/ui/Button";
import { Checkbox, FieldLabel, FieldRow, HelpText, Select, TextInput } from "@/components/ui/Field";
import { CloseIcon } from "@/components/ui/icons";
import { FEATURES } from "@/lib/config/features";
import { DEFAULT_NAMING, formatFilename, NAMING_PRESETS, sanitizeFilenamePart } from "@/lib/files/naming";
import { useCapabilities, useSelectedContext } from "@/lib/hooks";
import { resolveOutputFormat } from "@/lib/image/formats";
import { resolveOutputSize } from "@/lib/image/geometry";
import { describeTransform } from "@/lib/settings/describe";
import { validateConfig } from "@/lib/settings/validate";
import { useAssetStore } from "@/stores/useAssetStore";
import { usePresetStore } from "@/stores/usePresetStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import type { NamingOptions } from "@/types";

const RENAME_PATTERN = /^([^{}]*)-\{index\}$/;

type NamingMode = "original" | "dimensions" | "numbered" | "rename" | "custom";

function detectNamingMode(pattern: string): NamingMode {
  const preset = NAMING_PRESETS.find((candidate) => candidate.pattern === pattern);
  if (preset) return preset.id as NamingMode;
  return RENAME_PATTERN.test(pattern) ? "rename" : "custom";
}

function NamingControls() {
  const naming = useSettingsStore((state) => state.config.naming);
  const globalConfig = useSettingsStore((state) => state.config);
  const setConfig = useSettingsStore((state) => state.setConfig);
  const assetCount = useAssetStore((state) => state.assets.length);
  const capabilities = useCapabilities();
  const { asset } = useSelectedContext();
  const [mode, setMode] = useState<NamingMode>(() => detectNamingMode(naming.pattern));

  const update = (patch: Partial<NamingOptions>) => setConfig({ naming: { ...naming, ...patch } });
  const renameBase = RENAME_PATTERN.exec(naming.pattern)?.[1] ?? "";

  const changeMode = (next: NamingMode) => {
    setMode(next);
    const preset = NAMING_PRESETS.find((candidate) => candidate.id === next);
    if (preset) update({ pattern: preset.pattern });
    else if (next === "rename") update({ pattern: `${renameBase || "image"}-{index}` });
  };

  const size = asset ? resolveOutputSize(asset, globalConfig) : { width: 1200, height: 800 };
  const example = formatFilename(naming, {
    name: asset?.baseName ?? "vacation-photo",
    width: size.width,
    height: size.height,
    format: asset ? resolveOutputFormat(globalConfig.outputFormat, asset, capabilities) : globalConfig.outputFormat === "source" ? "jpeg" : globalConfig.outputFormat,
    index: 1,
    total: Math.max(assetCount, 1),
  });

  return (
    <div className="flex flex-col gap-3">
      <FieldRow label="File names" htmlFor="naming-mode">
        <Select id="naming-mode" value={mode} onChange={(event) => changeMode(event.target.value as NamingMode)}>
          {NAMING_PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.label}
            </option>
          ))}
          <option value="rename">Rename all…</option>
          <option value="custom">Custom pattern…</option>
        </Select>
      </FieldRow>

      {mode === "rename" && (
        <div>
          <FieldLabel htmlFor="rename-base" className="mb-1.5 block">
            New name (a number is added to each file)
          </FieldLabel>
          <TextInput
            id="rename-base"
            value={renameBase}
            maxLength={80}
            placeholder="wedding-photo"
            onChange={(event) => update({ pattern: `${event.target.value.replace(/[{}]/g, "")}-{index}` })}
          />
        </div>
      )}

      {mode === "custom" && (
        <div>
          <FieldLabel htmlFor="naming-pattern" className="mb-1.5 block">
            Pattern
          </FieldLabel>
          <TextInput
            id="naming-pattern"
            value={naming.pattern}
            maxLength={200}
            spellCheck={false}
            autoCapitalize="off"
            onChange={(event) => update({ pattern: event.target.value })}
            aria-describedby="naming-tokens"
            className="font-mono"
          />
          <HelpText id="naming-tokens" className="mt-1.5 font-mono">
            {"{name}"} {"{width}"} {"{height}"} {"{format}"} {"{index}"}
          </HelpText>
        </div>
      )}

      <div className="flex flex-wrap gap-x-5">
        <Checkbox label="Lowercase" checked={!!naming.lowercase} onChange={(event) => update({ lowercase: event.target.checked })} />
        <Checkbox
          label="Replace spaces with dashes"
          checked={!!naming.replaceSpaces}
          onChange={(event) => update({ replaceSpaces: event.target.checked, separator: naming.separator ?? DEFAULT_NAMING.separator })}
        />
      </div>

      <HelpText>
        Example <span className="ml-1 break-all font-mono text-fg-secondary">{example}</span>
      </HelpText>
    </div>
  );
}

function SavedPresets() {
  const presets = usePresetStore((state) => state.presets);
  const savePreset = usePresetStore((state) => state.savePreset);
  const removePreset = usePresetStore((state) => state.removePreset);
  const [name, setName] = useState("");

  const apply = (id: string) => {
    const preset = presets.find((candidate) => candidate.id === id);
    if (!preset) return;
    useSettingsStore.getState().replaceConfig(preset.config);
  };

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-medium text-fg">Saved presets</h3>
      {presets.length === 0 ? (
        <HelpText>Save the current settings to reuse them later. Presets stay in this browser.</HelpText>
      ) : (
        <ul className="divide-y divide-line-subtle">
          {presets.map((preset) => (
            <li key={preset.id} className="flex items-center gap-1 py-1.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-ui font-medium">{preset.name}</p>
                <p className="truncate text-xs text-fg-tertiary">{describeTransform(preset.config)}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => apply(preset.id)} aria-label={`Apply preset ${preset.name}`}>
                Apply
              </Button>
              <IconButton label={`Delete preset ${preset.name}`} onClick={() => void removePreset(preset.id)}>
                <CloseIcon width={14} height={14} />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim()) return;
          void savePreset(name, useSettingsStore.getState().config);
          setName("");
        }}
      >
        <label htmlFor="preset-name" className="sr-only">
          Preset name
        </label>
        <TextInput
          id="preset-name"
          value={name}
          maxLength={60}
          placeholder="Website thumbnails"
          onChange={(event) => setName(event.target.value)}
          className="min-w-0 flex-1"
        />
        <Button type="submit" disabled={!name.trim()}>
          Save
        </Button>
      </form>
    </div>
  );
}

function OutputVariants() {
  const variants = useSettingsStore((state) => state.variants);
  const config = useSettingsStore((state) => state.config);
  const addVariant = useSettingsStore((state) => state.addVariant);
  const removeVariant = useSettingsStore((state) => state.removeVariant);
  const [name, setName] = useState("");
  const problem = validateConfig(config);

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-medium text-fg">Multiple outputs</h3>
      {variants.length === 0 ? (
        <HelpText>
          Need several versions of each image? Set up one version, add it here, then change the settings and add the next.
        </HelpText>
      ) : (
        <>
          <ul className="divide-y divide-line-subtle">
            {variants.map((variant) => (
              <li key={variant.id} className="flex items-center gap-1 py-1.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-ui font-medium">{variant.name}</p>
                  <p className="truncate text-xs text-fg-tertiary">{describeTransform(variant.transform)}</p>
                </div>
                <IconButton label={`Remove output ${variant.name}`} onClick={() => removeVariant(variant.id)}>
                  <CloseIcon width={14} height={14} />
                </IconButton>
              </li>
            ))}
          </ul>
          <HelpText className="border-l-2 border-accent-text pl-2.5 text-fg-secondary">
            Every image is exported once per output above ({variants.length} each), into a folder per output in the ZIP. The
            settings now only edit the next output to add.
          </HelpText>
        </>
      )}
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const cleaned = sanitizeFilenamePart(name);
          if (!cleaned || problem) return;
          addVariant(cleaned.slice(0, 60));
          setName("");
        }}
      >
        <label htmlFor="variant-name" className="sr-only">
          Output name
        </label>
        <TextInput
          id="variant-name"
          value={name}
          maxLength={60}
          placeholder="thumbnail"
          onChange={(event) => setName(event.target.value)}
          className="min-w-0 flex-1"
        />
        <Button type="submit" disabled={!sanitizeFilenamePart(name) || !!problem}>
          Add output
        </Button>
      </form>
    </div>
  );
}

export function AdvancedControls() {
  return (
    <div className="flex flex-col gap-5">
      <NamingControls />
      <SavedPresets />
      {FEATURES.multiOutput && <OutputVariants />}
    </div>
  );
}
