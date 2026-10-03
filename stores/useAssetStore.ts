"use client";

import { create } from "zustand";
import type { SourceImage, TransformConfig } from "@/types";

interface AssetState {
  /** Lightweight metadata only. Decoded pixels never live in React state. */
  assets: SourceImage[];
  selectedId: string | null;
  /** One-off messages about files that were not added at all (e.g. batch limit). */
  notice: string | null;

  addAssets: (assets: SourceImage[]) => void;
  updateAsset: (id: string, patch: Partial<SourceImage>) => void;
  removeAssets: (ids: string[]) => void;
  select: (id: string | null) => void;
  setOverrides: (id: string, overrides: Partial<TransformConfig> | undefined) => void;
  setNotice: (notice: string | null) => void;
}

export const useAssetStore = create<AssetState>()((set) => ({
  assets: [],
  selectedId: null,
  notice: null,

  addAssets: (added) =>
    set((state) => ({
      assets: [...state.assets, ...added],
      selectedId: state.selectedId ?? added.find((asset) => asset.status !== "error")?.id ?? null,
    })),

  updateAsset: (id, patch) =>
    set((state) => {
      const assets = state.assets.map((asset) => (asset.id === id ? { ...asset, ...patch } : asset));
      let { selectedId } = state;
      // If the selected image turned out to be unreadable, move the preview to one that works.
      if (patch.status === "error" && selectedId === id) {
        selectedId = assets.find((asset) => asset.status !== "error")?.id ?? null;
      }
      return { assets, selectedId };
    }),

  removeAssets: (ids) =>
    set((state) => {
      const removed = new Set(ids);
      const assets = state.assets.filter((asset) => !removed.has(asset.id));
      let { selectedId } = state;
      if (selectedId && removed.has(selectedId)) {
        // Keep the selection near where it was instead of jumping to the top.
        const index = state.assets.findIndex((asset) => asset.id === selectedId);
        const candidates = [...state.assets.slice(index + 1), ...state.assets.slice(0, index).reverse()];
        selectedId = candidates.find((asset) => !removed.has(asset.id) && asset.status !== "error")?.id ?? null;
      }
      return { assets, selectedId };
    }),

  select: (id) => set({ selectedId: id }),

  setOverrides: (id, overrides) =>
    set((state) => ({
      assets: state.assets.map((asset) => (asset.id === id ? { ...asset, overrides } : asset)),
    })),

  setNotice: (notice) => set({ notice }),
}));

/** The config that applies to one asset: global settings with its own overrides on top. */
export function effectiveConfig(asset: Pick<SourceImage, "overrides">, globalConfig: TransformConfig): TransformConfig {
  return asset.overrides ? { ...globalConfig, ...asset.overrides } : globalConfig;
}
