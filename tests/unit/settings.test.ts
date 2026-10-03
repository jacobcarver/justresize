import * as z from "zod/mini";
import { describe, expect, it } from "vitest";
import { resolveOutputFormat } from "@/lib/image/formats";
import { resolveBackground } from "@/lib/image/transparency";
import { createDefaultConfig, DEFAULT_CONFIG } from "@/lib/settings/defaults";
import { parseQueryConfig } from "@/lib/settings/query";
import { sanitizeConfig, transformConfigSchema } from "@/lib/settings/schema";
import { summarizeOutput, validateConfig, validateForSource } from "@/lib/settings/validate";
import type { BrowserCapabilities, TransformConfig } from "@/types";

const capabilities: BrowserCapabilities = {
  offscreenCanvas: true,
  webWorkers: true,
  createImageBitmap: true,
  webpEncode: true,
  avifEncode: false,
};

const withConfig = (patch: Partial<TransformConfig>): TransformConfig => ({ ...createDefaultConfig(), ...patch });

describe("config schema", () => {
  it("accepts the default config", () => {
    expect(z.safeParse(transformConfigSchema, DEFAULT_CONFIG).success).toBe(true);
  });

  it("survives a JSON round trip (configs must be serializable)", () => {
    const config = withConfig({ width: 1200, aspectRatio: { w: 16, h: 9 }, targetFileSize: { bytes: 512000, strategy: "smart" } });
    expect(sanitizeConfig(JSON.parse(JSON.stringify(config)))).toEqual(config);
  });

  it("replaces only the invalid fields of stored data", () => {
    const recovered = sanitizeConfig({ width: -40, quality: 0.6, outputFormat: "bmp", fit: "contain" });
    expect(recovered.width).toBeUndefined();
    expect(recovered.outputFormat).toBe("source");
    expect(recovered.quality).toBe(0.6);
    expect(recovered.fit).toBe("contain");
  });

  it("returns defaults for anything that is not an object", () => {
    expect(sanitizeConfig(null)).toEqual(DEFAULT_CONFIG);
    expect(sanitizeConfig("width=100")).toEqual(DEFAULT_CONFIG);
    expect(sanitizeConfig(42)).toEqual(DEFAULT_CONFIG);
  });
});

describe("validateConfig", () => {
  it("accepts defaults", () => {
    expect(validateConfig(createDefaultConfig())).toBeNull();
  });

  it("rejects zero, negative, fractional and NaN dimensions", () => {
    expect(validateConfig(withConfig({ width: 0 }))).toBe("Width must be at least 1 px.");
    expect(validateConfig(withConfig({ height: -10 }))).toBe("Height must be at least 1 px.");
    expect(validateConfig(withConfig({ width: Number.NaN }))).toBe("Width must be at least 1 px.");
    expect(validateConfig(withConfig({ width: 10.5 }))).toBe("Width must be a whole number of pixels.");
  });

  it("rejects absurd sizes before any processing", () => {
    expect(validateConfig(withConfig({ width: 999999 }))).toContain("at most 32,767");
    expect(validateConfig(withConfig({ width: 192000, height: 108000, maintainAspectRatio: false }))).toContain("at most");
    expect(validateConfig(withConfig({ width: 30000, height: 30000, maintainAspectRatio: false }))).toContain("megapixels");
  });

  it("requires the inputs each mode needs", () => {
    expect(validateConfig(withConfig({ resizeMode: "max-dimensions" }))).toBe("Enter a maximum width or height.");
    expect(validateConfig(withConfig({ resizeMode: "percentage", percentage: undefined }))).toBe("Enter a percentage above 0.");
    expect(validateConfig(withConfig({ resizeMode: "percentage", percentage: 0 }))).toBe("Enter a percentage above 0.");
    expect(validateConfig(withConfig({ resizeMode: "target-filesize" }))).toBe("Enter a target file size.");
    expect(validateConfig(withConfig({ targetFileSize: { bytes: 10, strategy: "smart" } }))).toBe(
      "Target file size must be at least 1 KB.",
    );
  });

  it("catches per-image overflow", () => {
    const config = withConfig({ resizeMode: "percentage", percentage: 1000 });
    expect(validateConfig(config)).toBeNull();
    expect(validateForSource({ width: 8000, height: 6000 }, config)).toContain("too large");
    expect(validateForSource({ width: 800, height: 600 }, config)).toBeNull();
  });
});

describe("summarizeOutput", () => {
  const photo = { width: 4000, height: 3000, format: "jpeg" as const, hasTransparency: false, fileSize: 5_000_000 };
  const logo = { width: 800, height: 800, format: "png" as const, hasTransparency: true, fileSize: 200_000 };

  it("describes a simple resize with no warnings", () => {
    expect(summarizeOutput(photo, withConfig({ width: 1200 }), capabilities)).toEqual({
      size: { width: 1200, height: 900 },
      format: "jpeg",
      warnings: [],
    });
  });

  it("warns about enlargement", () => {
    const summary = summarizeOutput(photo, withConfig({ width: 8000 }), capabilities);
    expect(summary.warnings).toContain("This image will be enlarged and may appear softer.");
  });

  it("does not warn about enlargement when contain only adds padding", () => {
    const config = withConfig({ width: 5000, height: 3000, maintainAspectRatio: false, fit: "contain" });
    expect(summarizeOutput(photo, config, capabilities).warnings).toEqual([]);
  });

  it("warns about stretch distortion", () => {
    const config = withConfig({ width: 1000, height: 1000, maintainAspectRatio: false, fit: "stretch" });
    expect(summarizeOutput(photo, config, capabilities).warnings[0]).toContain("distorted");
  });

  it("warns when transparency will be flattened", () => {
    const summary = summarizeOutput(logo, withConfig({ outputFormat: "jpeg" }), capabilities);
    expect(summary.format).toBe("jpeg");
    expect(summary.warnings[0]).toContain("no transparency");
  });
});

describe("format and background resolution", () => {
  it("keeps the source format where it can be written", () => {
    expect(resolveOutputFormat("source", { format: "jpeg" }, capabilities)).toBe("jpeg");
    expect(resolveOutputFormat("source", { format: "png" }, capabilities)).toBe("png");
    expect(resolveOutputFormat("source", { format: "webp" }, capabilities)).toBe("webp");
  });

  it("maps unwritable sources to a safe format", () => {
    expect(resolveOutputFormat("source", { format: "gif" }, capabilities)).toBe("png");
    expect(resolveOutputFormat("source", { format: "heic" }, capabilities)).toBe("jpeg");
  });

  it("honours an explicit choice", () => {
    expect(resolveOutputFormat("webp", { format: "jpeg" }, capabilities)).toBe("webp");
  });

  it("never leaves transparency to turn black", () => {
    expect(resolveBackground({ type: "transparent", color: "#ff0000" }, "jpeg")).toBe("#ffffff");
    expect(resolveBackground({ type: "transparent", color: "#ffffff" }, "png")).toBeNull();
    expect(resolveBackground({ type: "transparent", color: "#ffffff" }, "webp")).toBeNull();
    expect(resolveBackground({ type: "color", color: "#000000" }, "png")).toBe("#000000");
    expect(resolveBackground({ type: "color", color: "#123456" }, "jpeg")).toBe("#123456");
    expect(resolveBackground({ type: "color", color: "javascript:alert(1)" }, "jpeg")).toBe("#ffffff");
  });
});

describe("parseQueryConfig", () => {
  const parse = (query: string) => parseQueryConfig(new URLSearchParams(query));

  it("returns null when there is nothing relevant", () => {
    expect(parse("")).toBeNull();
    expect(parse("utm_source=x")).toBeNull();
  });

  it("parses an exact size with format", () => {
    expect(parse("width=1200&height=630&format=webp")).toEqual({
      resizeMode: "dimensions",
      width: 1200,
      height: 630,
      aspectRatio: undefined,
      maintainAspectRatio: false,
      outputFormat: "webp",
    });
  });

  it("keeps the ratio locked for a single dimension", () => {
    expect(parse("width=800")).toMatchObject({ resizeMode: "dimensions", width: 800, maintainAspectRatio: true });
  });

  it("parses fit-within, percentage, quality and target size", () => {
    expect(parse("max=1600")).toMatchObject({ resizeMode: "max-dimensions", width: 1600, height: 1600 });
    expect(parse("max=1600x1200")).toMatchObject({ width: 1600, height: 1200 });
    expect(parse("percent=50")).toMatchObject({ resizeMode: "percentage", percentage: 50 });
    expect(parse("quality=70&format=jpg")).toEqual({ quality: 0.7, outputFormat: "jpeg" });
    expect(parse("target=500kb")).toEqual({
      resizeMode: "target-filesize",
      targetFileSize: { bytes: 512000, strategy: "smart" },
    });
  });

  it("ignores hostile or out-of-range values instead of trusting them", () => {
    expect(parse("width=999999999")).toBeNull();
    expect(parse("width=-5")).toBeNull();
    expect(parse("width=<script>")).toBeNull();
    expect(parse("format=exe")).toBeNull();
    expect(parse("quality=5000")).toBeNull();
    expect(parse("target=lots")).toBeNull();
    expect(parse("width=abc&format=png")).toEqual({ outputFormat: "png" });
  });
});
