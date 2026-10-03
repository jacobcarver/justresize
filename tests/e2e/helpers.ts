import { readFile } from "node:fs/promises";
import { expect, type Download, type Locator, type Page } from "@playwright/test";
import { unzipSync } from "fflate";
import { withExifOrientation } from "@/lib/image/metadata";
import { sniffImage } from "@/lib/image/sniff";

export interface TestFile {
  name: string;
  mimeType: string;
  buffer: Buffer;
}

export interface ImageSpec {
  name: string;
  width: number;
  height: number;
  type: "image/jpeg" | "image/png" | "image/webp";
  quality?: number;
  /**
   * - gradient: smooth, compresses well
   * - noise: random pixels, compresses badly (for large files)
   * - halves: left half red, right half blue (for crop assertions)
   * - transparent: opaque green circle on a fully transparent background
   * - corner: white with a red block in the top-left corner (for orientation assertions)
   */
  kind?: "gradient" | "noise" | "halves" | "transparent" | "corner";
}

/**
 * Test images are generated in the browser with canvas instead of being
 * committed as binary fixtures, so the repo stays small and the fixtures are
 * always exactly what the test describes.
 */
export async function makeImage(page: Page, spec: ImageSpec): Promise<TestFile> {
  const base64 = await page.evaluate(async ({ width, height, type, quality, kind }) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d")!;

    if (kind === "noise") {
      const image = context.createImageData(width, height);
      const data = new Uint32Array(image.data.buffer);
      let seed = 1234567;
      for (let i = 0; i < data.length; i++) {
        // xorshift: fast and deterministic, so sizes are stable between runs.
        seed ^= seed << 13;
        seed ^= seed >>> 17;
        seed ^= seed << 5;
        data[i] = 0xff000000 | (seed & 0x00ffffff);
      }
      context.putImageData(image, 0, 0);
    } else if (kind === "halves") {
      context.fillStyle = "#ff0000";
      context.fillRect(0, 0, width / 2, height);
      context.fillStyle = "#0000ff";
      context.fillRect(width / 2, 0, width / 2, height);
    } else if (kind === "transparent") {
      context.fillStyle = "#00aa00";
      context.beginPath();
      context.arc(width / 2, height / 2, Math.min(width, height) / 4, 0, Math.PI * 2);
      context.fill();
    } else if (kind === "corner") {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.fillStyle = "#ff0000";
      context.fillRect(0, 0, width / 4, height / 4);
    } else {
      const gradient = context.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, "#1e3a8a");
      gradient.addColorStop(0.5, "#f59e0b");
      gradient.addColorStop(1, "#be123c");
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);
    }

    const blob = await new Promise<Blob>((resolve) => canvas.toBlob((result) => resolve(result!), type, quality));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(binary);
  }, { ...spec, kind: spec.kind ?? "gradient", quality: spec.quality ?? 0.9 });

  return { name: spec.name, mimeType: spec.type, buffer: Buffer.from(base64, "base64") };
}

/** Tags a JPEG with an EXIF orientation, like a phone photo taken sideways. */
export function rotateViaExif(file: TestFile, orientation: number): TestFile {
  return { ...file, buffer: Buffer.from(withExifOrientation(new Uint8Array(file.buffer), orientation)) };
}

/** Opens the workspace (or a tool page) and waits until it is ready for images. */
export async function openApp(page: Page, path = "/app"): Promise<void> {
  await page.goto(path);
  await expect(page.getByRole("button", { name: /Choose images|Add images/ }).first()).toBeVisible();
}

/**
 * The settings only appear once an image is open, so tests that are about
 * settings rather than images start by adding this one.
 */
export async function addAnyImage(page: Page): Promise<void> {
  await addFiles(page, [await makeImage(page, { name: "any.jpg", width: 800, height: 600, type: "image/jpeg" })]);
  await waitForReady(page, 1);
}

export async function addFiles(page: Page, files: TestFile[]): Promise<void> {
  await page.getByTestId("file-input").setInputFiles(files);
}

export function rows(page: Page): Locator {
  return page.getByTestId("asset-row");
}

export async function waitForReady(page: Page, count: number): Promise<void> {
  await expect(page.locator('[data-testid="asset-row"][data-status="ready"]')).toHaveCount(count, { timeout: 30_000 });
}

export async function waitForComplete(page: Page, count: number, timeout = 45_000): Promise<void> {
  await expect(page.locator('[data-testid="job"][data-status="complete"]')).toHaveCount(count, { timeout });
}

export async function process(page: Page): Promise<void> {
  await page.getByTestId("process-button").click();
}

export async function readDownload(download: Download): Promise<Buffer> {
  const path = await download.path();
  return readFile(path);
}

/** Clicks something that triggers a download and returns the downloaded bytes. */
export async function downloadVia(page: Page, trigger: Locator): Promise<{ filename: string; data: Buffer }> {
  const [download] = await Promise.all([page.waitForEvent("download"), trigger.click()]);
  return { filename: download.suggestedFilename(), data: await readDownload(download) };
}

export function inspect(data: Buffer) {
  return sniffImage(new Uint8Array(data));
}

export function unzip(data: Buffer): Record<string, Uint8Array> {
  return unzipSync(new Uint8Array(data));
}

/** Decodes image bytes in the browser and samples pixels, to assert on what the output actually looks like. */
export async function samplePixels(
  page: Page,
  data: Buffer,
  mimeType: string,
  points: { x: number; y: number }[],
): Promise<{ width: number; height: number; pixels: [number, number, number, number][] }> {
  return page.evaluate(
    async ({ base64, mimeType, points }) => {
      const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([bytes], { type: mimeType }));
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d")!;
      context.drawImage(bitmap, 0, 0);
      const pixels = points.map(({ x, y }) => {
        const px = Math.min(bitmap.width - 1, Math.round(x * (bitmap.width - 1)));
        const py = Math.min(bitmap.height - 1, Math.round(y * (bitmap.height - 1)));
        return Array.from(context.getImageData(px, py, 1, 1).data) as [number, number, number, number];
      });
      return { width: bitmap.width, height: bitmap.height, pixels };
    },
    { base64: data.toString("base64"), mimeType, points },
  );
}

/** Decodes image bytes in the browser and returns every pixel as straight-alpha RGBA. */
export async function readPixels(
  page: Page,
  data: Buffer,
  mimeType: string,
): Promise<{ width: number; height: number; pixels: Uint8ClampedArray }> {
  const result = await page.evaluate(
    async ({ base64, mimeType }) => {
      const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([bytes], { type: mimeType }));
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d")!;
      context.drawImage(bitmap, 0, 0);
      const rgba = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
      let binary = "";
      for (let i = 0; i < rgba.length; i += 0x8000) binary += String.fromCharCode(...rgba.subarray(i, i + 0x8000));
      return { width: bitmap.width, height: bitmap.height, base64: btoa(binary) };
    },
    { base64: data.toString("base64"), mimeType },
  );
  return { width: result.width, height: result.height, pixels: new Uint8ClampedArray(Buffer.from(result.base64, "base64")) };
}

type Rgba = [number, number, number, number];

/** Lossy codecs shift colours slightly; compare with a tolerance. */
export function isColor(pixel: Rgba, expected: [number, number, number], tolerance = 40): boolean {
  return expected.every((channel, index) => Math.abs(pixel[index] - channel) <= tolerance);
}
