import { describe, expect, it } from "vitest";
import { checkSniffResult, hintedFormat, precheckFile } from "@/lib/files/validation";
import { orientationSwapsDimensions, orientationTransform, readExifOrientation, withExifOrientation } from "@/lib/image/metadata";
import { sniffImage } from "@/lib/image/sniff";

/** Smallest structurally valid JPEG header: SOI, APP0, SOF0 with the given size. */
function jpegHeader(width: number, height: number): Uint8Array {
  // prettier-ignore
  return new Uint8Array([
    0xff, 0xd8,
    0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
    0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 0xff, width >> 8, width & 0xff,
    0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
    0xff, 0xd9,
  ]);
}

function pngHeader(width: number, height: number, animated = false): Uint8Array {
  const bytes: number[] = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const u32 = (value: number) => [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
  const chunk = (type: string, data: number[]) => [...u32(data.length), ...[...type].map((c) => c.charCodeAt(0)), ...data, 0, 0, 0, 0];
  bytes.push(...chunk("IHDR", [...u32(width), ...u32(height), 8, 6, 0, 0, 0]));
  if (animated) bytes.push(...chunk("acTL", [...u32(2), ...u32(0)]));
  bytes.push(...chunk("IDAT", [0, 0, 0, 0]));
  return new Uint8Array(bytes);
}

function text(value: string): number[] {
  return [...value].map((c) => c.charCodeAt(0));
}

function gif(frames: number): Uint8Array {
  const bytes: number[] = [...text("GIF89a"), 20, 0, 10, 0, 0x80, 0, 0, /* 2-colour table */ 0, 0, 0, 255, 255, 255];
  for (let i = 0; i < frames; i++) {
    bytes.push(0x21, 0xf9, 4, 0, 0, 0, 0, 0); // graphic control extension
    bytes.push(0x2c, 0, 0, 0, 0, 20, 0, 10, 0, 0); // image descriptor
    bytes.push(2, 2, 0x4c, 0x01, 0); // LZW min code size + one data block + terminator
  }
  bytes.push(0x3b);
  return new Uint8Array(bytes);
}

function webpVp8x(width: number, height: number, animated: boolean): Uint8Array {
  const w = width - 1;
  const h = height - 1;
  return new Uint8Array([
    ...text("RIFF"), 0, 0, 0, 0, ...text("WEBP"), ...text("VP8X"), 10, 0, 0, 0,
    animated ? 0x02 : 0x00, 0, 0, 0,
    w & 0xff, (w >> 8) & 0xff, (w >> 16) & 0xff,
    h & 0xff, (h >> 8) & 0xff, (h >> 16) & 0xff,
  ]);
}

function isoBmff(...brands: string[]): Uint8Array {
  const size = 8 + 8 + (brands.length - 1) * 4;
  return new Uint8Array([0, 0, 0, size, ...text("ftyp"), ...text(brands[0]), 0, 0, 0, 0, ...brands.slice(1).flatMap(text)]);
}

describe("sniffImage", () => {
  it("reads JPEG dimensions", () => {
    expect(sniffImage(jpegHeader(4032, 3024))).toMatchObject({ format: "jpeg", width: 4032, height: 3024, orientation: 1 });
  });

  it("swaps JPEG dimensions for rotated EXIF orientations", () => {
    const rotated = withExifOrientation(jpegHeader(4032, 3024), 6);
    expect(sniffImage(rotated)).toMatchObject({ format: "jpeg", width: 3024, height: 4032, orientation: 6 });
  });

  it("reads PNG dimensions and detects APNG", () => {
    expect(sniffImage(pngHeader(800, 600))).toMatchObject({ format: "png", width: 800, height: 600 });
    expect(sniffImage(pngHeader(800, 600)).animated).toBeFalsy();
    expect(sniffImage(pngHeader(800, 600, true)).animated).toBe(true);
  });

  it("distinguishes still and animated GIFs", () => {
    expect(sniffImage(gif(1))).toMatchObject({ format: "gif", width: 20, height: 10, animated: false });
    expect(sniffImage(gif(3))).toMatchObject({ format: "gif", animated: true });
  });

  it("reads WebP (VP8X) dimensions and the animation flag", () => {
    expect(sniffImage(webpVp8x(1920, 1080, false))).toMatchObject({ format: "webp", width: 1920, height: 1080, animated: false });
    expect(sniffImage(webpVp8x(1920, 1080, true)).animated).toBe(true);
  });

  it("recognises AVIF and HEIC containers by brand", () => {
    expect(sniffImage(isoBmff("avif", "mif1", "miaf")).format).toBe("avif");
    expect(sniffImage(isoBmff("heic", "mif1")).format).toBe("heic");
    expect(sniffImage(isoBmff("mif1", "avif")).format).toBe("avif");
    expect(sniffImage(isoBmff("isom", "mp42")).format).toBeUndefined();
  });

  it("identifies common non-image files", () => {
    expect(sniffImage(new Uint8Array(text("%PDF-1.7\n%âãÏÓ rest of file"))).foreign).toBe("pdf");
    expect(sniffImage(new Uint8Array(text('<?xml version="1.0"?><svg xmlns="x"></svg>'))).foreign).toBe("svg");
  });

  it("returns nothing for garbage and truncated data", () => {
    expect(sniffImage(new Uint8Array(64))).toEqual({});
    expect(sniffImage(new Uint8Array([0xff, 0xd8]))).toEqual({});
  });

  it("survives a truncated JPEG without throwing", () => {
    const truncated = jpegHeader(100, 100).slice(0, 24);
    expect(sniffImage(truncated).format).toBe("jpeg");
    expect(sniffImage(truncated).width).toBeUndefined();
  });
});

describe("EXIF orientation", () => {
  it("defaults to 1 when there is no EXIF", () => {
    expect(readExifOrientation(jpegHeader(10, 10))).toBe(1);
    expect(readExifOrientation(pngHeader(10, 10))).toBe(1);
  });

  it("round-trips every orientation through withExifOrientation", () => {
    for (let orientation = 1; orientation <= 8; orientation++) {
      expect(readExifOrientation(withExifOrientation(jpegHeader(10, 10), orientation))).toBe(orientation);
    }
  });

  it("reads little-endian EXIF", () => {
    // prettier-ignore
    const exif = [
      0xff, 0xe1, 0x00, 0x22, ...text("Exif"), 0, 0,
      0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00,
      0x01, 0x00,
      0x12, 0x01, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00, 0x08, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
    ];
    const base = jpegHeader(10, 10);
    const jpeg = new Uint8Array([...base.slice(0, 2), ...exif, ...base.slice(2)]);
    expect(readExifOrientation(jpeg)).toBe(8);
  });

  it("knows which orientations swap dimensions", () => {
    expect([1, 2, 3, 4].some(orientationSwapsDimensions)).toBe(false);
    expect([5, 6, 7, 8].every(orientationSwapsDimensions)).toBe(true);
  });

  it("maps the stored corners to the right place for a 90° rotation", () => {
    // Orientation 6: stored top-left becomes visual top-right.
    const [a, b, c, d, e, f] = orientationTransform(6, 400, 300);
    const map = (x: number, y: number) => [a * x + c * y + e, b * x + d * y + f];
    expect(map(0, 0)).toEqual([300, 0]);
    expect(map(400, 300)).toEqual([0, 400]);
  });
});

describe("file validation", () => {
  const file = (name: string, type: string, size = 1000) => ({ name, type, size }) as File;

  it("accepts supported types by MIME or extension", () => {
    expect(precheckFile(file("a.jpg", "image/jpeg"))).toBeNull();
    expect(precheckFile(file("a.PNG", ""))).toBeNull();
    expect(precheckFile(file("a.webp", "image/webp"))).toBeNull();
    expect(hintedFormat(file("photo.JPEG", ""))).toBe("jpeg");
  });

  it("rejects unsupported files immediately with a useful message", () => {
    expect(precheckFile(file("report.pdf", "application/pdf"))?.message).toContain("PDF files aren't supported");
    expect(precheckFile(file("clip.mp4", "video/mp4"))?.message).toContain("Videos aren't supported");
    expect(precheckFile(file("logo.svg", "image/svg+xml"))?.message).toContain("SVG");
    expect(precheckFile(file("notes.txt", "text/plain"))?.message).toContain(".txt files aren't supported");
    expect(precheckFile(file("a.pdf", "application/pdf"))?.category).toBe("unsupported_format");
  });

  it("rejects empty files, and has no limit on file size", () => {
    expect(precheckFile(file("a.jpg", "image/jpeg", 0))?.message).toBe("This file is empty.");
    // The site says "No file size limit": bytes on disk are never the reason a file is turned away.
    // What is limited is decoded pixels (LIMITS.maxSourcePixels), which is checked once the header is read.
    expect(precheckFile(file("a.jpg", "image/jpeg", 300 * 1024 * 1024))).toBeNull();
    expect(precheckFile(file("a.jpg", "image/jpeg", 8 * 1024 * 1024 * 1024))).toBeNull();
  });

  it("explains what the bytes revealed", () => {
    expect(checkSniffResult({ format: "jpeg" })).toBeNull();
    expect(checkSniffResult({})?.category).toBe("decode_failed");
    expect(checkSniffResult({ foreign: "pdf" })?.message).toContain("actually a PDF");
    expect(checkSniffResult({ format: "gif", animated: true })?.message).toContain("Animated GIFs aren't supported yet");
    expect(checkSniffResult({ format: "gif", animated: false })).toBeNull();
  });
});
