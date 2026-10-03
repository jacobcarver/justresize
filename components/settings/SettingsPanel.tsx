"use client";

import { Button } from "@/components/ui/Button";
import { PanelSection } from "@/components/ui/Field";
import { ChevronDownIcon } from "@/components/ui/icons";
import { useAssetStore } from "@/stores/useAssetStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { AdvancedControls } from "./AdvancedControls";
import { OutputControls } from "./OutputControls";
import { ResizeControls } from "./ResizeControls";

/**
 * The inspector: all transform settings. Every control reads and writes the
 * single TransformConfig in the settings store; nothing here keeps its own copy.
 * Editing settings never starts processing — that only happens on Resize.
 *
 * One column when docked on wide screens and on phones; two on tablets,
 * where the panel sits under the preview and has the width to spare.
 */
export function SettingsPanel() {
  const advancedOpen = useSettingsStore((state) => state.ui.advancedOpen);
  const setUi = useSettingsStore((state) => state.setUi);
  const resetConfig = useSettingsStore((state) => state.resetConfig);
  const imageCount = useAssetStore((state) => state.assets.length);
  // Controls keep a little local UI state (e.g. "custom ratio" selected);
  // re-keying on revision clears it when a preset or reset replaces the config.
  const revision = useSettingsStore((state) => state.revision);

  return (
    <div className="divide-line-subtle max-md:divide-y md:max-lg:grid md:max-lg:grid-cols-2 md:max-lg:gap-x-10 lg:divide-y">
      <PanelSection
        title="Resize"
        aside={imageCount > 1 && <span className="text-xs text-fg-tertiary">Applies to all {imageCount.toLocaleString("en-US")} images</span>}
      >
        <ResizeControls key={revision} />
      </PanelSection>

      <div className="divide-y divide-line-subtle">
        <PanelSection title="Output">
          <OutputControls />
        </PanelSection>

        <section className="py-2 lg:px-5">
          <h2>
            <button
              type="button"
              aria-expanded={advancedOpen}
              aria-controls="advanced-settings"
              onClick={() => setUi({ advancedOpen: !advancedOpen })}
              className="flex h-9 w-full items-center justify-between rounded-control text-ui font-semibold text-fg touch:h-11"
            >
              Advanced
              <ChevronDownIcon
                className={`text-fg-tertiary transition-transform duration-150 ${advancedOpen ? "rotate-180" : ""}`}
              />
            </button>
          </h2>
          <div id="advanced-settings" hidden={!advancedOpen} className="pb-2 pt-2">
            {advancedOpen && <AdvancedControls key={revision} />}
          </div>
          {/* A quiet housekeeping action: it belongs with the other rarely used things, open or closed. */}
          <Button variant="ghost" size="sm" className="-ml-2 mb-1" onClick={resetConfig}>
            Reset settings
          </Button>
        </section>
      </div>
    </div>
  );
}
