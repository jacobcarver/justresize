"use client";

import { HelpText, Select } from "@/components/ui/Field";
import { NumberField } from "@/components/ui/NumberField";
import { Segmented } from "@/components/ui/Segmented";
import { STRATEGY_LABELS } from "@/lib/settings/describe";
import { type ByteUnit, fromBytes, toBytes } from "@/lib/utils/bytes";
import { useSettingsStore } from "@/stores/useSettingsStore";
import type { TargetFileSize, TargetSizeStrategy } from "@/types";

const STRATEGIES: TargetSizeStrategy[] = ["smart", "quality-only", "dimensions"];

/** Size + unit + strategy. Used by the "File size" mode and by the optional limit in other modes. */
export function TargetSizeFields({ idPrefix, label }: { idPrefix: string; label: string }) {
  const stored = useSettingsStore((state) => state.config.targetFileSize);
  const lastTarget = useSettingsStore((state) => state.ui.lastTarget);
  const unit = useSettingsStore((state) => state.ui.sizeUnit);
  const setTarget = useSettingsStore((state) => state.setTarget);
  const setUi = useSettingsStore((state) => state.setUi);

  const target: TargetFileSize = stored ?? lastTarget;
  const value = target.bytes > 0 ? fromBytes(target.bytes, unit) : undefined;

  const changeUnit = (next: ByteUnit) => {
    // Keep the number the user typed; "500" KB becomes "500" MB, not 0.49.
    setUi({ sizeUnit: next });
    if (value !== undefined) setTarget({ ...target, bytes: toBytes(value, next) });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end gap-2">
        <NumberField
          id={`${idPrefix}-value`}
          label={label}
          decimal
          value={value}
          onChange={(next) => setTarget({ ...target, bytes: next === undefined ? 0 : toBytes(next, unit) })}
          invalid={target.bytes < 1024}
          className="min-w-0 flex-1"
        />
        <div className="w-20 shrink-0">
          <label htmlFor={`${idPrefix}-unit`} className="sr-only">
            Unit
          </label>
          <Select id={`${idPrefix}-unit`} value={unit} onChange={(event) => changeUnit(event.target.value as ByteUnit)}>
            <option value="KB">KB</option>
            <option value="MB">MB</option>
          </Select>
        </div>
      </div>

      <div>
        <Segmented
          name={`${idPrefix}-strategy`}
          legend="How to get there"
          value={target.strategy}
          options={STRATEGIES.map((strategy) => ({ value: strategy, label: STRATEGY_LABELS[strategy].label }))}
          onChange={(strategy) => setTarget({ ...target, strategy })}
        />
        <HelpText className="mt-1.5">{STRATEGY_LABELS[target.strategy].description}</HelpText>
      </div>
    </div>
  );
}
