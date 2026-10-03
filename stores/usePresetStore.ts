"use client";

import { create } from "zustand";
import { LocalPresetRepository, type PresetRepository } from "@/lib/presets/repository";
import { createId } from "@/lib/utils/id";
import type { SavedPreset, TransformConfig } from "@/types";

/** Swap this for a cloud-backed repository when accounts exist. */
const repository: PresetRepository = new LocalPresetRepository();

interface PresetState {
  presets: SavedPreset[];
  loaded: boolean;
  load: () => Promise<void>;
  savePreset: (name: string, config: TransformConfig) => Promise<void>;
  removePreset: (id: string) => Promise<void>;
}

export const usePresetStore = create<PresetState>()((set, get) => ({
  presets: [],
  loaded: false,

  load: async () => {
    if (get().loaded) return;
    set({ presets: await repository.list(), loaded: true });
  },

  savePreset: async (name, config) => {
    const preset: SavedPreset = {
      id: createId("preset"),
      name: name.trim().slice(0, 60) || "Untitled preset",
      createdAt: Date.now(),
      config: structuredClone(config),
    };
    await repository.save(preset);
    set({ presets: await repository.list() });
  },

  removePreset: async (id) => {
    await repository.remove(id);
    set({ presets: await repository.list() });
  },
}));
