"use client";

import * as z from "zod/mini";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createDefaultConfig, DEFAULT_TARGET } from "@/lib/settings/defaults";
import { sanitizeConfig, targetFileSizeSchema } from "@/lib/settings/schema";
import type { ByteUnit } from "@/lib/utils/bytes";
import { createId } from "@/lib/utils/id";
import type { OutputVariant, ResizeMode, TargetFileSize, TransformConfig } from "@/types";

interface UiPreferences {
  advancedOpen: boolean;
  sizeUnit: ByteUnit;
  /** Remembered so the file-size field comes back with the last value used. */
  lastTarget: TargetFileSize;
}

interface SettingsState {
  /** The one transform configuration every control reads and writes. */
  config: TransformConfig;
  /** Multi-output: when non-empty, every image is exported once per variant. */
  variants: OutputVariant[];
  ui: UiPreferences;
  /** Bumped whenever the config is replaced wholesale, so controls can drop their local UI state. */
  revision: number;

  setConfig: (patch: Partial<TransformConfig>) => void;
  setMode: (mode: ResizeMode) => void;
  setTarget: (target: TargetFileSize | undefined) => void;
  resetConfig: () => void;
  replaceConfig: (config: TransformConfig) => void;
  setUi: (patch: Partial<UiPreferences>) => void;

  addVariant: (name: string) => void;
  removeVariant: (id: string) => void;
  clearVariants: () => void;
}

const DEFAULT_UI: UiPreferences = {
  advancedOpen: false,
  sizeUnit: "MB",
  lastTarget: DEFAULT_TARGET,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      config: createDefaultConfig(),
      variants: [],
      ui: DEFAULT_UI,
      revision: 0,

      setConfig: (patch) => set((state) => ({ config: { ...state.config, ...patch } })),

      setMode: (mode) =>
        set((state) => {
          if (mode === state.config.resizeMode) return state;
          const config = { ...state.config, resizeMode: mode };
          // The file-size mode is defined by having a target; leaving it
          // drops the target so it never lingers as a hidden limit.
          if (mode === "target-filesize") config.targetFileSize = state.ui.lastTarget;
          else if (state.config.resizeMode === "target-filesize") config.targetFileSize = undefined;
          return { config };
        }),

      setTarget: (target) =>
        set((state) => ({
          config: { ...state.config, targetFileSize: target },
          ui: target ? { ...state.ui, lastTarget: target } : state.ui,
        })),

      resetConfig: () => set((state) => ({ config: createDefaultConfig(), revision: state.revision + 1 })),

      replaceConfig: (config) =>
        set((state) => ({ config: sanitizeConfig(structuredClone(config)), revision: state.revision + 1 })),

      setUi: (patch) => set((state) => ({ ui: { ...state.ui, ...patch } })),

      addVariant: (name) =>
        set((state) => ({
          variants: [
            ...state.variants,
            { id: createId("variant"), name, transform: structuredClone(get().config) },
          ],
        })),
      removeVariant: (id) => set((state) => ({ variants: state.variants.filter((variant) => variant.id !== id) })),
      clearVariants: () => set({ variants: [] }),
    }),
    {
      name: "justresize:settings",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Settings only. Images are never persisted.
      partialize: (state) => ({ config: state.config, variants: state.variants, ui: state.ui }),
      // Stored data is untrusted: validate every part and fall back to defaults.
      merge: (persisted, current) => {
        const stored = (persisted ?? {}) as Partial<Pick<SettingsState, "config" | "variants" | "ui">>;
        const storedUi = (stored.ui ?? {}) as Partial<UiPreferences>;
        const lastTarget = z.safeParse(targetFileSizeSchema, storedUi.lastTarget);
        return {
          ...current,
          config: sanitizeConfig(stored.config),
          variants: Array.isArray(stored.variants)
            ? stored.variants
                .filter((variant) => variant && typeof variant.id === "string" && typeof variant.name === "string")
                .map((variant) => ({
                  id: variant.id,
                  name: variant.name.slice(0, 60),
                  transform: sanitizeConfig(variant.transform),
                }))
            : [],
          ui: {
            advancedOpen: storedUi.advancedOpen === true,
            sizeUnit: storedUi.sizeUnit === "KB" ? "KB" : "MB",
            lastTarget: lastTarget.success ? lastTarget.data : DEFAULT_TARGET,
          },
        };
      },
    },
  ),
);
