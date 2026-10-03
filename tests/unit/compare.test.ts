import { describe, expect, it } from "vitest";
import { sameConfig } from "@/lib/settings/compare";
import { createDefaultConfig } from "@/lib/settings/defaults";

describe("sameConfig", () => {
  it("treats a deep copy as the same settings", () => {
    const config = { ...createDefaultConfig(), width: 800 };
    expect(sameConfig(config, structuredClone(config))).toBe(true);
  });

  it("ignores key order and undefined properties", () => {
    const config = createDefaultConfig();
    const { resizeMode, ...rest } = config;
    const reordered = { ...rest, resizeMode, targetFileSize: undefined, width: undefined };
    expect(sameConfig(config, reordered)).toBe(true);
  });

  it("notices a changed value, including nested ones", () => {
    const config = createDefaultConfig();
    expect(sameConfig(config, { ...config, width: 800 })).toBe(false);
    expect(sameConfig(config, { ...config, quality: 0.5 })).toBe(false);
    expect(sameConfig(config, { ...config, crop: { ...config.crop, x: 0.2 } })).toBe(false);
    expect(sameConfig(config, { ...config, naming: { ...config.naming, pattern: "{name}-small" } })).toBe(false);
  });
});
