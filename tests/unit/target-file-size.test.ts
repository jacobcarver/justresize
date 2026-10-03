import { describe, expect, it } from "vitest";
import { ImageError } from "@/lib/image/errors";
import { compressToTarget, type CompressToTargetOptions, TargetUnreachableError } from "@/lib/image/target-file-size";

const dimensions = { width: 4000, height: 3000 };

/**
 * A plausible JPEG-like size model: bytes grow with pixel count and rise
 * steeply with quality.
 */
function modelEncoder(bytesPerPixelAtFullQuality: number) {
  const calls: { scale: number; quality: number | undefined }[] = [];
  const encode: CompressToTargetOptions<string>["encode"] = async (scale, quality) => {
    calls.push({ scale, quality });
    const pixels = Math.round(dimensions.width * scale) * Math.round(dimensions.height * scale);
    const q = quality ?? 1;
    const size = Math.round(pixels * bytesPerPixelAtFullQuality * (0.08 + 0.92 * q ** 3));
    return { size, payload: `${scale}@${quality}` };
  };
  return { encode, calls };
}

function run(overrides: Partial<CompressToTargetOptions<string>> & Pick<CompressToTargetOptions<string>, "encode">) {
  return compressToTarget<string>({
    targetBytes: 500 * 1024,
    strategy: "smart",
    lossy: true,
    dimensions,
    maxQuality: 0.92,
    ...overrides,
  });
}

describe("compressToTarget", () => {
  it("returns the first encode when it already fits", async () => {
    const { encode, calls } = modelEncoder(0.01);
    const result = await run({ encode });
    expect(calls).toHaveLength(1);
    expect(result.qualityUsed).toBe(0.92);
    expect(result.resizedForTarget).toBe(false);
    expect(result.iterations).toBe(1);
  });

  it("quality-only: finds a high quality that stays under the target", async () => {
    const { encode, calls } = modelEncoder(0.12);
    const target = 500 * 1024;
    const result = await run({ encode, strategy: "quality-only", targetBytes: target });

    expect(result.size).toBeLessThanOrEqual(target);
    expect(result.resizedForTarget).toBe(false);
    expect(result.width).toBe(4000);
    // Close to the target, not just any passing quality.
    expect(result.size).toBeGreaterThan(target * 0.9);
    expect(calls.length).toBeLessThanOrEqual(8);
  });

  it("quality-only: the result is the best of everything it tried", async () => {
    const sizes: number[] = [];
    const { encode } = modelEncoder(0.12);
    const target = 500 * 1024;
    const result = await run({
      strategy: "quality-only",
      targetBytes: target,
      encode: async (scale, quality) => {
        const out = await encode(scale, quality);
        sizes.push(out.size);
        return out;
      },
    });
    const bestPossible = Math.max(...sizes.filter((size) => size <= target));
    expect(result.size).toBe(bestPossible);
  });

  it("quality-only: fails clearly when minimum quality is still too big", async () => {
    const { encode, calls } = modelEncoder(2);
    await expect(run({ encode, strategy: "quality-only" })).rejects.toBeInstanceOf(TargetUnreachableError);
    expect(calls.length).toBeLessThanOrEqual(3);
    expect(calls.every((call) => call.scale === 1)).toBe(true);
  });

  it("smart: shrinks dimensions when quality alone is not enough", async () => {
    const { encode } = modelEncoder(2);
    const target = 500 * 1024;
    const result = await run({ encode, strategy: "smart", targetBytes: target });

    expect(result.size).toBeLessThanOrEqual(target);
    expect(result.resizedForTarget).toBe(true);
    expect(result.width).toBeLessThan(4000);
    expect(result.width / result.height).toBeCloseTo(4 / 3, 1);
    // Smart never drops below its quality floor; it gives up pixels instead.
    expect(result.qualityUsed).toBeGreaterThanOrEqual(0.6);
  });

  it("smart: does not touch dimensions when quality is enough", async () => {
    const { encode } = modelEncoder(0.12);
    const result = await run({ encode, strategy: "smart", targetBytes: 600 * 1024 });
    expect(result.resizedForTarget).toBe(false);
    expect(result.size).toBeLessThanOrEqual(600 * 1024);
  });

  it("dimensions: keeps quality fixed and reduces size only", async () => {
    const { encode, calls } = modelEncoder(0.5);
    const target = 500 * 1024;
    const result = await run({ encode, strategy: "dimensions", maxQuality: 0.82, targetBytes: target });

    expect(result.size).toBeLessThanOrEqual(target);
    expect(result.qualityUsed).toBe(0.82);
    expect(calls.every((call) => call.quality === 0.82)).toBe(true);
    expect(result.resizedForTarget).toBe(true);
    // The refinement step should not leave a lot of headroom unused.
    expect(result.size).toBeGreaterThan(target * 0.8);
  });

  it("lossless: smart reduces dimensions because there is no quality to lower", async () => {
    const { encode, calls } = modelEncoder(1.5);
    const target = 800 * 1024;
    const result = await run({ encode, lossy: false, strategy: "smart", targetBytes: target });

    expect(result.size).toBeLessThanOrEqual(target);
    expect(result.qualityUsed).toBeUndefined();
    expect(calls.every((call) => call.quality === undefined)).toBe(true);
    expect(result.resizedForTarget).toBe(true);
  });

  it("lossless: quality-only fails after a single attempt", async () => {
    const { encode, calls } = modelEncoder(1.5);
    await expect(run({ encode, lossy: false, strategy: "quality-only", targetBytes: 10 * 1024 })).rejects.toBeInstanceOf(
      TargetUnreachableError,
    );
    expect(calls).toHaveLength(1);
  });

  describe("PNG: colours before dimensions", () => {
    /**
     * A PNG-like size model: full colour costs 3 bytes a pixel, a palette costs
     * its bit depth (8 bits for 256 colours, 5 for 32, 3 for 8).
     */
    function pngEncoder() {
      const calls: { scale: number; colors: number | undefined }[] = [];
      const encode: CompressToTargetOptions<string>["encode"] = async (scale, quality, colors) => {
        expect(quality).toBeUndefined();
        calls.push({ scale, colors });
        const pixels = Math.round(dimensions.width * scale) * Math.round(dimensions.height * scale);
        const size = Math.round(colors === undefined ? pixels * 3 : (pixels * Math.log2(colors)) / 8);
        return { size, payload: `${scale}/${colors}` };
      };
      return { encode, calls };
    }
    const png = { lossy: false, reducibleColors: true } as const;
    const MB = 1024 * 1024;

    it("returns the lossless file untouched when it already fits", async () => {
      const { encode, calls } = pngEncoder();
      const result = await run({ ...png, encode, targetBytes: 40 * MB });
      expect(calls).toEqual([{ scale: 1, colors: undefined }]);
      expect(result.colorsUsed).toBeUndefined();
      expect(result.resizedForTarget).toBe(false);
    });

    it("smart: reduces colours and keeps the dimensions when that is enough", async () => {
      const { encode } = pngEncoder();
      // 12 MP: 256 colours is 12 MB, 32 colours is 7.5 MB.
      const result = await run({ ...png, encode, targetBytes: 10 * MB });
      expect(result.resizedForTarget).toBe(false);
      expect(result.width).toBe(4000);
      expect(result.size).toBeLessThanOrEqual(10 * MB);
      // The largest palette that fits, not just any that does.
      expect(result.colorsUsed).toBeGreaterThanOrEqual(64);
      expect(result.colorsUsed).toBeLessThan(256);
      expect(result.size).toBeGreaterThan(9 * MB);
    });

    it("smart: prefers the full palette when it fits", async () => {
      const { encode, calls } = pngEncoder();
      const result = await run({ ...png, encode, targetBytes: 13 * MB });
      expect(result.colorsUsed).toBe(256);
      expect(calls).toHaveLength(2);
    });

    it("smart: shrinks dimensions only once the palette floor is too big, and keeps a palette", async () => {
      const { encode, calls } = pngEncoder();
      // 32 colours at full size is 7.5 MB, so 2 MB needs smaller dimensions too.
      const result = await run({ ...png, encode, targetBytes: 2 * MB });
      expect(result.resizedForTarget).toBe(true);
      expect(result.size).toBeLessThanOrEqual(2 * MB);
      expect(result.colorsUsed).toBeGreaterThanOrEqual(32);
      // Nothing below the smart floor was ever tried.
      expect(calls.every((call) => call.colors === undefined || call.colors >= 32)).toBe(true);
      // Far less was given up than the lossless route (3 bytes a pixel) would need.
      expect(result.width).toBeGreaterThan(1800);
    });

    it("compress only: goes down to the minimum palette but never changes dimensions", async () => {
      const { encode, calls } = pngEncoder();
      // 8 colours is 4.5 MB.
      const result = await run({ ...png, encode, strategy: "quality-only", targetBytes: 5 * MB });
      expect(result.resizedForTarget).toBe(false);
      expect(result.colorsUsed).toBeGreaterThanOrEqual(8);
      expect(result.colorsUsed).toBeLessThan(32);
      expect(calls.every((call) => call.scale === 1)).toBe(true);

      const tooSmall = run({ ...png, encode, strategy: "quality-only", targetBytes: 4 * MB });
      await expect(tooSmall).rejects.toBeInstanceOf(TargetUnreachableError);
      expect(calls.every((call) => call.scale === 1)).toBe(true);
    });

    it("resize only: keeps every colour and shrinks instead", async () => {
      const { encode, calls } = pngEncoder();
      const result = await run({ ...png, encode, strategy: "dimensions", targetBytes: 10 * MB });
      expect(calls.every((call) => call.colors === undefined)).toBe(true);
      expect(result.colorsUsed).toBeUndefined();
      expect(result.resizedForTarget).toBe(true);
    });

    it("never encodes the same dimensions and palette twice", async () => {
      const { encode, calls } = pngEncoder();
      await run({ ...png, encode, targetBytes: 2 * MB });
      const keys = calls.map((call) => `${call.scale}/${call.colors}`);
      expect(new Set(keys).size).toBe(keys.length);
    });
  });

  it("never encodes the same dimensions and quality twice", async () => {
    const { encode, calls } = modelEncoder(0.12);
    await run({ encode, strategy: "quality-only" });
    const keys = calls.map((call) => `${call.scale}@${call.quality}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  describe("termination", () => {
    const strategies = ["quality-only", "smart", "dimensions"] as const;

    const kinds = [
      { name: "lossy", lossy: true },
      { name: "lossless", lossy: false },
      { name: "lossless with a palette", lossy: false, reducibleColors: true },
    ];

    for (const strategy of strategies) {
      for (const { name, ...kind } of kinds) {
        it(`${strategy} (${name}) stops when size never changes`, async () => {
          let calls = 0;
          const attempt = run({
            strategy,
            ...kind,
            targetBytes: 10 * 1024,
            encode: async () => {
              calls += 1;
              return { size: 5 * 1024 * 1024, payload: "x" };
            },
          });
          await expect(attempt).rejects.toBeInstanceOf(TargetUnreachableError);
          expect(calls).toBeLessThanOrEqual(30);
        });

        it(`${strategy} (${name}) stops when size behaves erratically`, async () => {
          let calls = 0;
          let seed = 7;
          const noisy = () => {
            seed = (seed * 1103515245 + 12345) % 2147483648;
            return seed / 2147483648;
          };
          const attempt = run({
            strategy,
            ...kind,
            targetBytes: 300 * 1024,
            encode: async () => {
              calls += 1;
              return { size: Math.round(100 * 1024 + noisy() * 800 * 1024), payload: "x" };
            },
          });
          // It may succeed or fail — it just has to finish, under the target if it succeeds.
          const result = await attempt.catch((error: Error) => error);
          if (!(result instanceof Error)) expect(result.size).toBeLessThanOrEqual(300 * 1024);
          expect(calls).toBeLessThanOrEqual(80);
        });
      }
    }

    it("stops at the minimum edge instead of shrinking forever", async () => {
      let calls = 0;
      const attempt = compressToTarget<string>({
        targetBytes: 10,
        strategy: "smart",
        lossy: true,
        dimensions: { width: 64, height: 48 },
        maxQuality: 0.92,
        encode: async (scale) => {
          calls += 1;
          return { size: Math.round(5000 * scale * scale) + 500, payload: "x" };
        },
      });
      await expect(attempt).rejects.toBeInstanceOf(TargetUnreachableError);
      expect(calls).toBeLessThanOrEqual(30);
    });
  });

  it("reports the smallest size it managed when it fails", async () => {
    const { encode } = modelEncoder(2);
    const error = await run({ encode, strategy: "quality-only" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(TargetUnreachableError);
    expect((error as TargetUnreachableError).smallestBytes).toBeGreaterThan(500 * 1024);
  });

  it("respects cancellation between encodes", async () => {
    const controller = new AbortController();
    const { encode } = modelEncoder(2);
    let calls = 0;
    const attempt = run({
      signal: controller.signal,
      encode: async (scale, quality) => {
        calls += 1;
        if (calls === 2) controller.abort();
        return encode(scale, quality);
      },
    });
    await expect(attempt).rejects.toBeInstanceOf(ImageError);
    await expect(attempt).rejects.toMatchObject({ category: "cancelled" });
    expect(calls).toBe(2);
  });

  it("uses the caller's quality as a ceiling", async () => {
    const { encode, calls } = modelEncoder(0.12);
    const result = await run({ encode, strategy: "quality-only", maxQuality: 0.7, targetBytes: 5 * 1024 * 1024 });
    expect(result.qualityUsed).toBe(0.7);
    expect(Math.max(...calls.map((call) => call.quality ?? 0))).toBe(0.7);
  });
});
