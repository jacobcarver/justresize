import { describe, expect, it } from "vitest";
import { resample, type ResampleOptions } from "@/lib/image/resample";
import { sharpenAmount } from "@/lib/image/resize";

type Rgba = [number, number, number, number];

function makeImage(width: number, height: number, pixel: (x: number, y: number) => Rgba): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) data.set(pixel(x, y), (y * width + x) * 4);
  }
  return data;
}

/** Runs the resampler against an in-memory image, checking it never reads outside it. */
function run(
  pixels: Uint8ClampedArray,
  options: Omit<ResampleOptions, "region"> & { region?: ResampleOptions["region"] },
): Uint8ClampedArray {
  const { source, target } = options;
  const out = new Uint8ClampedArray(target.width * target.height * 4);
  let nextRow = 0;
  resample(
    { ...options, region: options.region ?? { x: 0, y: 0, width: source.width, height: source.height } },
    {
      read(x, y, width, height) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(x + width).toBeLessThanOrEqual(source.width);
        expect(y + height).toBeLessThanOrEqual(source.height);
        const band = new Uint8ClampedArray(width * height * 4);
        for (let row = 0; row < height; row++) {
          const start = ((y + row) * source.width + x) * 4;
          band.set(pixels.subarray(start, start + width * 4), row * width * 4);
        }
        return band;
      },
      write(y, height, band) {
        expect(y).toBe(nextRow);
        expect(band.length).toBe(height * target.width * 4);
        out.set(band, y * target.width * 4);
        nextRow = y + height;
      },
    },
  );
  expect(nextRow).toBe(target.height);
  return out;
}

function pixelAt(data: Uint8ClampedArray, width: number, x: number, y: number): Rgba {
  const i = (y * width + x) * 4;
  return [data[i], data[i + 1], data[i + 2], data[i + 3]];
}

describe("resample", () => {
  it("keeps a flat colour exactly flat, sharpened or not", () => {
    const source = { width: 90, height: 60 };
    const pixels = makeImage(90, 60, () => [37, 142, 201, 255]);
    for (const sharpen of [0, 0.4]) {
      const out = run(pixels, { source, target: { width: 30, height: 20 }, sharpen });
      for (let i = 0; i < out.length; i += 4) {
        expect([out[i], out[i + 1], out[i + 2], out[i + 3]]).toEqual([37, 142, 201, 255]);
      }
    }
  });

  it("keeps a hard edge within a couple of pixels", () => {
    const source = { width: 300, height: 30 };
    const pixels = makeImage(300, 30, (x) => (x < 150 ? [0, 0, 0, 255] : [255, 255, 255, 255]));
    const out = run(pixels, { source, target: { width: 100, height: 10 }, sharpen: 0.4 });
    for (let x = 0; x < 100; x++) {
      const [value] = pixelAt(out, 100, x, 5);
      if (x < 48) expect(value).toBeLessThanOrEqual(2);
      if (x >= 52) expect(value).toBeGreaterThanOrEqual(253);
    }
  });

  it("averages detail finer than the output instead of aliasing", () => {
    // One-pixel black and white stripes shrunk 4× have no representable detail left: flat mid grey.
    const source = { width: 400, height: 40 };
    const pixels = makeImage(400, 40, (x) => (x % 2 ? [255, 255, 255, 255] : [0, 0, 0, 255]));
    const out = run(pixels, { source, target: { width: 100, height: 10 } });
    for (let x = 4; x < 96; x++) {
      const [value] = pixelAt(out, 100, x, 5);
      expect(Math.abs(value - 127.5)).toBeLessThan(3);
    }
  });

  it("gives the same bytes however the image is split into bands", () => {
    const source = { width: 157, height: 131 };
    const pixels = makeImage(157, 131, (x, y) => [(x * 7) % 256, (y * 13) % 256, (x * y) % 256, (x + y) % 2 ? 255 : 90]);
    const options = { source, target: { width: 50, height: 41 }, sharpen: 0.4 };
    const whole = run(pixels, options);
    expect(run(pixels, { ...options, bandPixels: 1 })).toEqual(whole);
    expect(run(pixels, { ...options, bandPixels: 1000 })).toEqual(whole);
  });

  it("does not let the colour of transparent pixels bleed into visible ones", () => {
    // Left half: fully transparent but red underneath. Right half: opaque blue.
    const source = { width: 120, height: 12 };
    const pixels = makeImage(120, 12, (x) => (x < 60 ? [255, 0, 0, 0] : [0, 0, 255, 255]));
    const out = run(pixels, { source, target: { width: 40, height: 4 }, sharpen: 0.4 });
    for (let x = 0; x < 40; x++) {
      const [red, , blue, alpha] = pixelAt(out, 40, x, 2);
      if (alpha === 0) continue;
      expect(red).toBeLessThanOrEqual(1);
      expect(blue).toBeGreaterThanOrEqual(254);
    }
    expect(pixelAt(out, 40, 5, 2)[3]).toBe(0);
    expect(pixelAt(out, 40, 35, 2)[3]).toBe(255);
  });

  it("keeps opaque images fully opaque", () => {
    const source = { width: 64, height: 64 };
    const pixels = makeImage(64, 64, (x, y) => [(x * 37) % 256, (y * 91) % 256, ((x ^ y) * 17) % 256, 255]);
    const out = run(pixels, { source, target: { width: 21, height: 23 }, sharpen: 0.4 });
    for (let i = 3; i < out.length; i += 4) expect(out[i]).toBe(255);
  });

  it("samples only the requested region", () => {
    const source = { width: 200, height: 100 };
    const pixels = makeImage(200, 100, (x) => (x < 100 ? [255, 0, 0, 255] : [0, 0, 255, 255]));
    const out = run(pixels, {
      source,
      region: { x: 120.5, y: 10, width: 60, height: 80 },
      target: { width: 15, height: 20 },
    });
    for (let i = 0; i < out.length; i += 4) expect([out[i], out[i + 1], out[i + 2], out[i + 3]]).toEqual([0, 0, 255, 255]);
  });

  it("handles single-row and single-column outputs", () => {
    const source = { width: 50, height: 40 };
    const pixels = makeImage(50, 40, () => [10, 20, 30, 255]);
    expect(Array.from(run(pixels, { source, target: { width: 1, height: 1 }, sharpen: 0.4 }))).toEqual([10, 20, 30, 255]);
    expect(run(pixels, { source, target: { width: 25, height: 1 }, sharpen: 0.4 }).length).toBe(100);
    expect(run(pixels, { source, target: { width: 1, height: 20 }, sharpen: 0.4 }).length).toBe(80);
  });

  it("can shrink one axis while enlarging the other", () => {
    const source = { width: 80, height: 10 };
    const pixels = makeImage(80, 10, (x) => (x < 40 ? [0, 0, 0, 255] : [255, 255, 255, 255]));
    const out = run(pixels, { source, target: { width: 20, height: 30 } });
    expect(pixelAt(out, 20, 2, 15)).toEqual([0, 0, 0, 255]);
    expect(pixelAt(out, 20, 17, 15)).toEqual([255, 255, 255, 255]);
  });

  it("sharpening steepens a soft edge without moving it", () => {
    // A grey step: overshoot either side of the edge is the unsharp mask at work.
    const source = { width: 300, height: 30 };
    const pixels = makeImage(300, 30, (x) => (x < 150 ? [64, 64, 64, 255] : [192, 192, 192, 255]));
    const plain = run(pixels, { source, target: { width: 100, height: 10 } });
    const sharp = run(pixels, { source, target: { width: 100, height: 10 }, sharpen: 0.4 });
    expect(pixelAt(sharp, 100, 49, 5)[0]).toBeLessThan(pixelAt(plain, 100, 49, 5)[0]);
    expect(pixelAt(sharp, 100, 50, 5)[0]).toBeGreaterThan(pixelAt(plain, 100, 50, 5)[0]);
    expect(pixelAt(sharp, 100, 20, 5)[0]).toBe(64);
    expect(pixelAt(sharp, 100, 80, 5)[0]).toBe(192);
  });
});

describe("sharpen strength", () => {
  it("is off when nothing is discarded and full from a 2× reduction", () => {
    expect(sharpenAmount(1, 0.4)).toBe(0);
    expect(sharpenAmount(0.5, 0.4)).toBe(0);
    expect(sharpenAmount(1.5, 0.4)).toBeCloseTo(0.2);
    expect(sharpenAmount(2, 0.4)).toBeCloseTo(0.4);
    expect(sharpenAmount(8, 0.4)).toBeCloseTo(0.4);
  });
});
