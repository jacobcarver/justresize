import { unzlibSync } from "fflate";
import { describe, expect, it } from "vitest";
import { encodeIndexedPng } from "@/lib/image/png";
import { quantize, type QuantizedImage } from "@/lib/image/quantize";

type Rgba = [number, number, number, number];

function makeImage(width: number, height: number, pixel: (x: number, y: number) => Rgba): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) data.set(pixel(x, y), (y * width + x) * 4);
  }
  return data;
}

/** The colour a quantized image shows at one pixel. */
function colorAt(image: QuantizedImage, pixel: number): Rgba {
  const p = image.indices[pixel] * 4;
  return [image.palette[p], image.palette[p + 1], image.palette[p + 2], image.palette[p + 3]];
}

/** A smooth two-axis gradient: thousands of distinct colours. */
const gradient = (width: number, height: number) =>
  makeImage(width, height, (x, y) => [(x * 255) / (width - 1), (y * 255) / (height - 1), 128, 255]);

describe("quantize", () => {
  it("keeps an image with few colours exactly as it is", () => {
    const colors: Rgba[] = [[255, 0, 0, 255], [0, 128, 255, 255], [17, 17, 17, 255], [250, 250, 250, 128]];
    const pixels = makeImage(40, 30, (x, y) => colors[(x + y * 3) % 4]);
    const result = quantize(pixels, 40, 30, 256, { dither: 0.5 });
    expect(result.lossless).toBe(true);
    expect(result.palette.length / 4).toBe(4);
    for (let i = 0; i < 40 * 30; i++) expect(colorAt(result, i)).toEqual(Array.from(pixels.subarray(i * 4, i * 4 + 4)));
  });

  it("treats every fully transparent pixel as one colour, whatever is hidden underneath", () => {
    const pixels = makeImage(20, 20, (x, y) => (x < 10 ? [x * 20, y * 10, 99, 0] : [0, 0, 255, 255]));
    const result = quantize(pixels, 20, 20, 256);
    expect(result.lossless).toBe(true);
    expect(result.palette.length / 4).toBe(2);
    expect(colorAt(result, 0)).toEqual([0, 0, 0, 0]);
    expect(colorAt(result, 15)).toEqual([0, 0, 255, 255]);
  });

  it("never uses more colours than asked for", () => {
    const pixels = gradient(96, 64);
    for (const limit of [2, 8, 31, 256]) {
      const result = quantize(pixels, 96, 64, limit);
      expect(result.lossless).toBe(false);
      expect(result.palette.length / 4).toBeLessThanOrEqual(limit);
      expect(Math.max(...result.indices)).toBeLessThan(result.palette.length / 4);
    }
  });

  it("stays close to the original, and closer with more colours", () => {
    const pixels = gradient(128, 128);
    const meanError = (limit: number): number => {
      const result = quantize(pixels, 128, 128, limit);
      let total = 0;
      for (let i = 0; i < 128 * 128; i++) {
        const color = colorAt(result, i);
        for (let c = 0; c < 3; c++) total += Math.abs(color[c] - pixels[i * 4 + c]);
      }
      return total / (128 * 128 * 3);
    };
    const coarse = meanError(16);
    const fine = meanError(256);
    expect(fine).toBeLessThan(coarse);
    expect(fine).toBeLessThan(5);
  });

  it("gives a small but distinct colour its own palette entry", () => {
    // A red 4×4 mark on a large noisy grey field: 0.1% of the pixels.
    const pixels = makeImage(128, 128, (x, y) => {
      if (x >= 60 && x < 64 && y >= 60 && y < 64) return [230, 20, 30, 255];
      const grey = 100 + ((x * 7 + y * 13) % 60);
      return [grey, grey, grey + ((x * y) % 5), 255];
    });
    const result = quantize(pixels, 128, 128, 16);
    const [r, g, b] = colorAt(result, 61 * 128 + 61);
    expect(r).toBeGreaterThan(200);
    expect(g).toBeLessThan(60);
    expect(b).toBeLessThan(60);
  });

  it("keeps opaque pixels opaque and transparent pixels transparent, with or without dithering", () => {
    const pixels = makeImage(64, 64, (x, y) => {
      if (x < 16) return [0, 0, 0, 0];
      if (x < 32) return [200, (y * 4) % 256, 40, 60 + y * 2];
      return [(x * 4) % 256, (y * 4) % 256, (x * y) % 256, 255];
    });
    for (const dither of [0, 0.5, 1]) {
      const result = quantize(pixels, 64, 64, 32, { dither });
      for (let y = 0; y < 64; y++) {
        expect(colorAt(result, y * 64 + 5)[3]).toBe(0);
        expect(colorAt(result, y * 64 + 50)[3]).toBe(255);
      }
    }
  });

  it("lets a soft shadow fade out instead of ending in a visible step", () => {
    // Black with alpha falling from 120 to 0, next to detailed opaque content that wants most of the palette.
    const pixels = makeImage(128, 64, (x, y) =>
      x < 64 ? [(x * 37 + y * 11) % 256, (x * 5 + y * 71) % 256, (x * y) % 256, 255] : [0, 0, 0, Math.round(((127 - x) * 120) / 63)],
    );
    for (const dither of [0, 0.5]) {
      const result = quantize(pixels, 128, 64, 16, { dither });
      // The faintest end of the shadow reaches full transparency…
      expect(colorAt(result, 32 * 128 + 126)[3]).toBe(0);
      // …the dense end is still clearly there, and opaque content is untouched by it.
      expect(colorAt(result, 32 * 128 + 66)[3]).toBeGreaterThan(60);
      expect(colorAt(result, 32 * 128 + 10)[3]).toBe(255);
    }
  });

  it("lists translucent colours first and counts them", () => {
    const pixels = makeImage(64, 64, (x, y) => [(x * 4) % 256, (y * 4) % 256, 90, x < 32 ? 255 : (y * 4) % 256]);
    const result = quantize(pixels, 64, 64, 32);
    const alphas = Array.from({ length: result.palette.length / 4 }, (_, k) => result.palette[k * 4 + 3]);
    expect(result.translucentColors).toBe(alphas.filter((alpha) => alpha < 255).length);
    expect(result.translucentColors).toBeGreaterThan(0);
    expect(alphas.slice(0, result.translucentColors).every((alpha) => alpha < 255)).toBe(true);
    expect(alphas.slice(result.translucentColors).every((alpha) => alpha === 255)).toBe(true);
  });

  it("dithering mixes neighbouring colours so a gradient keeps its average tone", () => {
    // A horizontal grey ramp forced into 8 colours: without dithering, wide flat bands.
    const pixels = makeImage(256, 32, (x) => [x, x, x, 255]);
    const flat = quantize(pixels, 256, 32, 8);
    const dithered = quantize(pixels, 256, 32, 8, { dither: 1 });
    const blockError = (image: QuantizedImage): number => {
      let total = 0;
      for (let block = 0; block < 32; block++) {
        let shown = 0;
        let wanted = 0;
        for (let y = 0; y < 32; y++) {
          for (let x = block * 8; x < block * 8 + 8; x++) {
            shown += colorAt(image, y * 256 + x)[0];
            wanted += x;
          }
        }
        total += Math.abs(shown - wanted) / 256;
      }
      return total / 32;
    };
    expect(blockError(dithered)).toBeLessThan(blockError(flat) / 2);
  });

  it("is deterministic", () => {
    const pixels = gradient(80, 60);
    const a = quantize(pixels, 80, 60, 24, { dither: 0.5 });
    const b = quantize(pixels, 80, 60, 24, { dither: 0.5 });
    expect(a.palette).toEqual(b.palette);
    expect(a.indices).toEqual(b.indices);
  });
});

describe("encodeIndexedPng", () => {
  function chunks(png: Uint8Array): { type: string; data: Uint8Array; crcOk: boolean }[] {
    const table = new Uint32Array(256).map((_, n) => {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      return c;
    });
    const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
    const out = [];
    for (let offset = 8; offset < png.length; ) {
      const length = view.getUint32(offset);
      const type = String.fromCharCode(...png.subarray(offset + 4, offset + 8));
      let crc = 0xffffffff;
      for (let i = offset + 4; i < offset + 8 + length; i++) crc = table[(crc ^ png[i]) & 255] ^ (crc >>> 8);
      out.push({
        type,
        data: png.subarray(offset + 8, offset + 8 + length),
        crcOk: ((crc ^ 0xffffffff) >>> 0) === view.getUint32(offset + 8 + length),
      });
      offset += 12 + length;
    }
    return out;
  }

  it("writes a valid 8-bit palette PNG whose pixel data round-trips", () => {
    const width = 37;
    const height = 11;
    const pixels = gradient(width, height);
    const image = quantize(pixels, width, height, 64);
    const png = encodeIndexedPng({ width, height, ...image });

    expect(Array.from(png.subarray(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    const parts = chunks(png);
    expect(parts.map((part) => part.type)).toEqual(["IHDR", "PLTE", "IDAT", "IEND"]);
    expect(parts.every((part) => part.crcOk)).toBe(true);

    const header = new DataView(parts[0].data.buffer, parts[0].data.byteOffset, 13);
    expect([header.getUint32(0), header.getUint32(4)]).toEqual([width, height]);
    expect([parts[0].data[8], parts[0].data[9]]).toEqual([8, 3]);
    expect(parts[1].data.length).toBe((image.palette.length / 4) * 3);

    const raw = unzlibSync(parts[2].data);
    expect(raw.length).toBe(height * (width + 1));
    for (let y = 0; y < height; y++) {
      expect(raw[y * (width + 1)]).toBe(0);
      expect(Array.from(raw.subarray(y * (width + 1) + 1, (y + 1) * (width + 1)))).toEqual(
        Array.from(image.indices.subarray(y * width, (y + 1) * width)),
      );
    }
  });

  it("packs small palettes into fewer bits per pixel", () => {
    const width = 10;
    const height = 3;
    const colors: Rgba[] = [[0, 0, 0, 255], [255, 255, 255, 255], [255, 0, 0, 255]];
    const pixels = makeImage(width, height, (x, y) => colors[(x + y) % 3]);
    const image = quantize(pixels, width, height, 256);
    const parts = chunks(encodeIndexedPng({ width, height, ...image }));
    expect(parts[0].data[8]).toBe(2);

    const raw = unzlibSync(parts.find((part) => part.type === "IDAT")!.data);
    const rowBytes = Math.ceil((width * 2) / 8);
    expect(raw.length).toBe(height * (rowBytes + 1));
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const byte = raw[y * (rowBytes + 1) + 1 + (x >> 2)];
        expect((byte >> (6 - (x & 3) * 2)) & 3).toBe(image.indices[y * width + x]);
      }
    }
  });

  it("writes an alpha table covering exactly the translucent colours", () => {
    const pixels = makeImage(8, 8, (x) => (x < 2 ? [0, 0, 0, 0] : x < 4 ? [255, 0, 0, 128] : [0, 0, 255, 255]));
    const image = quantize(pixels, 8, 8, 256);
    const parts = chunks(encodeIndexedPng({ width: 8, height: 8, ...image }));
    expect(parts.map((part) => part.type)).toEqual(["IHDR", "PLTE", "tRNS", "IDAT", "IEND"]);
    expect(Array.from(parts[2].data)).toEqual([0, 128]);
    expect(parts.every((part) => part.crcOk)).toBe(true);
  });
});
