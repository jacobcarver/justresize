/**
 * Config equality, used to tell whether a finished result was made with the
 * settings currently on screen. Key order and undefined-valued properties do
 * not count as differences.
 */
import type { TransformConfig } from "@/types";

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      if (record[key] !== undefined) sorted[key] = normalize(record[key]);
    }
    return sorted;
  }
  return value;
}

// Configs are replaced, never mutated, so a key computed once stays valid.
const keys = new WeakMap<TransformConfig, string>();

export function configKey(config: TransformConfig): string {
  let key = keys.get(config);
  if (key === undefined) {
    key = JSON.stringify(normalize(config));
    keys.set(config, key);
  }
  return key;
}

export function sameConfig(a: TransformConfig, b: TransformConfig): boolean {
  return a === b || configKey(a) === configKey(b);
}
