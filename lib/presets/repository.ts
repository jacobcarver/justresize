/**
 * Where saved presets live. Today that is this browser's localStorage; the
 * interface exists so a CloudPresetRepository can be dropped in when
 * accounts arrive, without the UI or stores changing.
 *
 * Presets hold settings only — never images.
 */
import * as z from "zod/mini";
import { sanitizeConfig } from "@/lib/settings/schema";
import type { SavedPreset } from "@/types";

export interface PresetRepository {
  list(): Promise<SavedPreset[]>;
  save(preset: SavedPreset): Promise<void>;
  remove(id: string): Promise<void>;
}

const STORAGE_KEY = "justresize:presets";

const storedPresetSchema = z.object({
  id: z.string().check(z.minLength(1), z.maxLength(100)),
  name: z.string().check(z.minLength(1), z.maxLength(100)),
  createdAt: z.number(),
  config: z.unknown(),
});

export class LocalPresetRepository implements PresetRepository {
  private read(): SavedPreset[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.flatMap((entry) => {
        const result = z.safeParse(storedPresetSchema, entry);
        if (!result.success) return [];
        return [{ ...result.data, config: sanitizeConfig(result.data.config) }];
      });
    } catch {
      return [];
    }
  }

  private write(presets: SavedPreset[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
    } catch {
      // Storage full or blocked (private mode): presets just do not persist.
    }
  }

  async list(): Promise<SavedPreset[]> {
    return this.read();
  }

  async save(preset: SavedPreset): Promise<void> {
    const presets = this.read().filter((existing) => existing.id !== preset.id);
    presets.push(preset);
    this.write(presets);
  }

  async remove(id: string): Promise<void> {
    this.write(this.read().filter((preset) => preset.id !== id));
  }
}
