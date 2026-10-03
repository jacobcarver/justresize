import { expect, test } from "@playwright/test";
import { resample } from "@/lib/image/resample";
import { sharpenAmount } from "@/lib/image/resize";
import {
  addFiles,
  downloadVia,
  inspect,
  isColor,
  makeImage,
  openApp,
  process,
  readPixels,
  rotateViaExif,
  rows,
  samplePixels,
  unzip,
  waitForComplete,
  waitForReady,
} from "./helpers";

const KB = 1024;

test.describe("target file size", () => {
  test("a multi-megabyte photo ends up under 500 KB, close to the limit @cross-browser", async ({ page }) => {
    await openApp(page);
    // Random noise is the worst case for JPEG, so this is a genuinely large file.
    const big = await makeImage(page, { name: "application-photo.jpg", width: 2400, height: 1800, type: "image/jpeg", quality: 0.95, kind: "noise" });
    expect(big.buffer.length).toBeGreaterThan(4 * KB * KB);
    await addFiles(page, [big]);
    await waitForReady(page, 1);

    await page.getByText("File size", { exact: true }).click();
    await page.getByLabel("Make each image smaller than").fill("500");
    await page.getByLabel("Unit").selectOption("KB");
    await expect(page.getByTestId("output-summary")).toContainText("under 500 KB");

    await process(page);
    await waitForComplete(page, 1, 90_000);

    const { data } = await downloadVia(page, page.getByTestId("download-all"));
    // The promise is "smaller than", so the limit is a hard ceiling…
    expect(data.length).toBeLessThanOrEqual(500 * KB);
    // …but the result should use most of the budget, not just any passing size.
    expect(data.length).toBeGreaterThan(350 * KB);
    expect(inspect(data).format).toBe("jpeg");
  });

  test("compress-only keeps dimensions", async ({ page }) => {
    await openApp(page);
    await addFiles(page, [await makeImage(page, { name: "photo.jpg", width: 1600, height: 1200, type: "image/jpeg", quality: 0.95, kind: "noise" })]);
    await waitForReady(page, 1);

    await page.getByText("File size", { exact: true }).click();
    await page.getByLabel("Make each image smaller than").fill("1");
    await page.getByLabel("Unit").selectOption("MB");
    await page.getByText("Compress only", { exact: true }).click();
    await process(page);
    await waitForComplete(page, 1, 90_000);

    const { data } = await downloadVia(page, page.getByTestId("download-all"));
    expect(data.length).toBeLessThanOrEqual(KB * KB);
    expect(inspect(data)).toMatchObject({ width: 1600, height: 1200 });
  });

  test("smart mode shrinks dimensions when compression alone cannot get there, and says so", async ({ page }) => {
    await openApp(page);
    await addFiles(page, [await makeImage(page, { name: "photo.jpg", width: 2000, height: 1500, type: "image/jpeg", quality: 0.95, kind: "noise" })]);
    await waitForReady(page, 1);

    await page.getByText("File size", { exact: true }).click();
    await page.getByLabel("Make each image smaller than").fill("100");
    await page.getByLabel("Unit").selectOption("KB");
    await process(page);
    await waitForComplete(page, 1, 90_000);

    await expect(rows(page).first()).toContainText("Target file size required reducing dimensions from 2000 × 1500 to");
    const { data } = await downloadVia(page, page.getByTestId("download-all"));
    expect(data.length).toBeLessThanOrEqual(100 * KB);
    const info = inspect(data);
    expect(info.width).toBeLessThan(2000);
    expect(info.width! / info.height!).toBeCloseTo(4 / 3, 1);
  });

  test("an impossible target fails with advice instead of looping or lying", async ({ page }) => {
    await openApp(page);
    await addFiles(page, [await makeImage(page, { name: "noise.png", width: 1200, height: 1200, type: "image/png", kind: "noise" })]);
    await waitForReady(page, 1);

    await page.getByText("File size", { exact: true }).click();
    await page.getByLabel("Make each image smaller than").fill("10");
    await page.getByLabel("Unit").selectOption("KB");
    await page.getByText("Compress only", { exact: true }).click();
    await process(page);

    await expect(rows(page).first()).toContainText("Unable to reach 10 KB while preserving the selected format and dimensions", { timeout: 30_000 });
    await expect(rows(page).first()).toContainText("Try the Smart option");
    await expect(page.getByRole("button", { name: "Retry noise.png" })).toBeVisible();
  });

  test("a PNG gets under the limit by reducing colours, not dimensions @cross-browser", async ({ page }) => {
    await openApp(page);
    // Noise does not compress, so the lossless file (~1.4 MB) cannot fit and neither can 256 colours (~480 KB).
    const file = await makeImage(page, { name: "detail.png", width: 800, height: 600, type: "image/png", kind: "noise" });
    expect(file.buffer.length).toBeGreaterThan(KB * KB);
    await addFiles(page, [file]);
    await waitForReady(page, 1);

    await page.getByText("File size", { exact: true }).click();
    await page.getByLabel("Make each image smaller than").fill("400");
    await page.getByLabel("Unit").selectOption("KB");
    await expect(page.getByText("colours are reduced before dimensions")).toBeVisible();
    await process(page);
    await waitForComplete(page, 1, 90_000);

    await expect(rows(page).first()).toContainText(/Target file size required reducing the image to \d+ colours\./);
    await expect(rows(page).first()).not.toContainText("reducing dimensions");
    const { data } = await downloadVia(page, page.getByTestId("download-all"));
    expect(data.length).toBeLessThanOrEqual(400 * KB);
    // Uses most of the budget: the largest palette that fits.
    expect(data.length).toBeGreaterThan(300 * KB);
    expect(inspect(data)).toMatchObject({ format: "png", width: 800, height: 600 });
    // Byte 25 of a PNG is its colour type: 3 is a palette image.
    expect(data[25]).toBe(3);

    // The browser must be able to open what we wrote, at full size, with a limited set of colours.
    const output = await readPixels(page, data, "image/png");
    expect([output.width, output.height]).toEqual([800, 600]);
    const colors = new Set<number>();
    const view = new DataView(output.pixels.buffer, output.pixels.byteOffset, output.pixels.byteLength);
    for (let i = 0; i < output.pixels.length; i += 4) colors.add(view.getUint32(i));
    expect(colors.size).toBeGreaterThan(32);
    expect(colors.size).toBeLessThanOrEqual(256);
  });

  test("a file-size limit can be combined with a resize", async ({ page }) => {
    await openApp(page);
    await addFiles(page, [await makeImage(page, { name: "photo.jpg", width: 2000, height: 1500, type: "image/jpeg", quality: 0.95, kind: "noise" })]);
    await waitForReady(page, 1);

    await page.getByLabel("Width", { exact: true }).fill("1000");
    await page.getByLabel("Limit file size").check();
    await page.getByLabel("Keep each file under").fill("200");
    await page.getByLabel("Unit").selectOption("KB");
    await page.getByText("Compress only", { exact: true }).click();
    await process(page);
    await waitForComplete(page, 1, 60_000);

    const { data } = await downloadVia(page, page.getByTestId("download-all"));
    expect(data.length).toBeLessThanOrEqual(200 * KB);
    expect(inspect(data)).toMatchObject({ width: 1000, height: 750 });
  });
});

test.describe("transparency", () => {
  test("PNG → JPEG fills transparent areas with white, never black @cross-browser", async ({ page }) => {
    await openApp(page);
    await addFiles(page, [await makeImage(page, { name: "logo.png", width: 400, height: 400, type: "image/png", kind: "transparent" })]);
    await waitForReady(page, 1);

    await page.getByLabel("Format").selectOption("jpeg");
    await expect(page.getByText("JPEG has no transparency")).toBeVisible();
    await process(page);
    await waitForComplete(page, 1);

    const { data } = await downloadVia(page, page.getByTestId("download-all"));
    const { pixels } = await samplePixels(page, data, "image/jpeg", [{ x: 0.02, y: 0.02 }, { x: 0.5, y: 0.5 }]);
    expect(isColor(pixels[0], [255, 255, 255])).toBe(true);
    expect(isColor(pixels[1], [0, 170, 0])).toBe(true);
  });

  test("PNG → JPEG uses the chosen background colour", async ({ page }) => {
    await openApp(page);
    await addFiles(page, [await makeImage(page, { name: "logo.png", width: 400, height: 400, type: "image/png", kind: "transparent" })]);
    await waitForReady(page, 1);

    await page.getByLabel("Format").selectOption("jpeg");
    await page.getByText("Black", { exact: true }).click();
    await process(page);
    await waitForComplete(page, 1);

    const { data } = await downloadVia(page, page.getByTestId("download-all"));
    const { pixels } = await samplePixels(page, data, "image/jpeg", [{ x: 0.02, y: 0.02 }]);
    expect(isColor(pixels[0], [0, 0, 0])).toBe(true);
  });

  test("PNG → WebP and PNG → PNG keep transparency @cross-browser", async ({ page }) => {
    await openApp(page);
    await addFiles(page, [await makeImage(page, { name: "logo.png", width: 400, height: 400, type: "image/png", kind: "transparent" })]);
    await waitForReady(page, 1);

    for (const [format, mime] of [["webp", "image/webp"], ["png", "image/png"]] as const) {
      await page.getByLabel("Format").selectOption(format);
      await page.getByLabel("Width", { exact: true }).fill("200");
      await process(page);
      await waitForComplete(page, 1);
      await expect(page.getByTestId("job")).toContainText(format === "webp" ? "WebP" : "PNG");

      const { data } = await downloadVia(page, page.getByTestId("download-all"));
      const { width, pixels } = await samplePixels(page, data, mime, [{ x: 0.02, y: 0.02 }, { x: 0.5, y: 0.5 }]);
      expect(width).toBe(200);
      expect(pixels[0][3]).toBe(0);
      expect(pixels[1][3]).toBe(255);
    }
  });
});

test.describe("orientation", () => {
  test("EXIF-rotated photos come out upright with metadata stripped @cross-browser", async ({ page }) => {
    await openApp(page);
    // Stored as 400×200 landscape with a red block top-left, tagged "rotate 90° clockwise".
    const stored = await makeImage(page, { name: "sideways.jpg", width: 400, height: 200, type: "image/jpeg", quality: 0.95, kind: "corner" });
    await addFiles(page, [rotateViaExif(stored, 6)]);
    await waitForReady(page, 1);

    // Dimensions reported to the user are the upright ones.
    await expect(rows(page).first()).toContainText("200 × 400");

    await page.getByLabel("Format").selectOption("png");
    await process(page);
    await waitForComplete(page, 1);

    const { data } = await downloadVia(page, page.getByTestId("download-all"));
    const result = await samplePixels(page, data, "image/png", [{ x: 0.95, y: 0.03 }, { x: 0.05, y: 0.03 }, { x: 0.5, y: 0.9 }]);
    expect(result.width).toBe(200);
    expect(result.height).toBe(400);
    // After rotation the red block belongs in the top-RIGHT corner.
    expect(isColor(result.pixels[0], [255, 0, 0])).toBe(true);
    expect(isColor(result.pixels[1], [255, 255, 255])).toBe(true);
    expect(isColor(result.pixels[2], [255, 255, 255])).toBe(true);
    // No EXIF survives into the output.
    expect(data.includes(Buffer.from("Exif"))).toBe(false);
  });
});

test.describe("fit modes", () => {
  const halves = { name: "halves.png", width: 1000, height: 500, type: "image/png", kind: "halves" } as const;

  async function setExactSize(page: import("@playwright/test").Page, width: string, height: string) {
    await page.getByRole("button", { name: "Lock aspect ratio" }).click();
    await page.getByLabel("Width", { exact: true }).fill(width);
    await page.getByLabel("Height", { exact: true }).fill(height);
  }

  test("cover crops from the centre, and the crop position changes what is exported", async ({ page }) => {
    await openApp(page);
    await addFiles(page, [await makeImage(page, halves)]);
    await waitForReady(page, 1);
    await setExactSize(page, "400", "400");
    await expect(page.getByTestId("output-summary")).toContainText("400 × 400");

    await process(page);
    await waitForComplete(page, 1);
    let download = await downloadVia(page, page.getByTestId("download-all"));
    let result = await samplePixels(page, download.data, "image/png", [{ x: 0.1, y: 0.5 }, { x: 0.9, y: 0.5 }]);
    expect(result.width).toBe(400);
    expect(result.height).toBe(400);
    // Centre crop: red on the left, blue on the right.
    expect(isColor(result.pixels[0], [255, 0, 0])).toBe(true);
    expect(isColor(result.pixels[1], [0, 0, 255])).toBe(true);

    // Move the crop to the left edge: the export is now entirely red.
    await page.getByRole("button", { name: "Crop position: Left", exact: true }).click();
    await process(page);
    await waitForComplete(page, 1);
    download = await downloadVia(page, page.getByTestId("download-all"));
    result = await samplePixels(page, download.data, "image/png", [{ x: 0.1, y: 0.5 }, { x: 0.9, y: 0.5 }]);
    expect(isColor(result.pixels[0], [255, 0, 0])).toBe(true);
    expect(isColor(result.pixels[1], [255, 0, 0])).toBe(true);
  });

  test("dragging the preview repositions the crop in the export", async ({ page }) => {
    await openApp(page);
    await addFiles(page, [await makeImage(page, halves)]);
    await waitForReady(page, 1);
    await setExactSize(page, "400", "400");

    const canvas = page.getByTestId("preview-canvas");
    await expect(canvas).toBeVisible();
    const box = (await canvas.boundingBox())!;
    // Drag the image far to the left, revealing its right (blue) side.
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x - box.width * 2, box.y + box.height / 2, { steps: 8 });
    await page.mouse.up();

    await process(page);
    await waitForComplete(page, 1);
    const { data } = await downloadVia(page, page.getByTestId("download-all"));
    const { pixels } = await samplePixels(page, data, "image/png", [{ x: 0.1, y: 0.5 }, { x: 0.9, y: 0.5 }]);
    expect(isColor(pixels[0], [0, 0, 255])).toBe(true);
    expect(isColor(pixels[1], [0, 0, 255])).toBe(true);

    // Reset returns to the centred crop.
    await page.getByRole("button", { name: "Reset crop" }).click();
    await process(page);
    await waitForComplete(page, 1);
    const again = await downloadVia(page, page.getByTestId("download-all"));
    const centred = await samplePixels(page, again.data, "image/png", [{ x: 0.1, y: 0.5 }]);
    expect(isColor(centred.pixels[0], [255, 0, 0])).toBe(true);
  });

  test("contain keeps the whole image and pads with the chosen background", async ({ page }) => {
    await openApp(page);
    await addFiles(page, [await makeImage(page, halves)]);
    await waitForReady(page, 1);
    await setExactSize(page, "400", "400");
    await page.getByText("Contain", { exact: true }).click();
    await page.getByText("Black", { exact: true }).click();

    await process(page);
    await waitForComplete(page, 1);
    const { data } = await downloadVia(page, page.getByTestId("download-all"));
    const { width, height, pixels } = await samplePixels(page, data, "image/png", [
      { x: 0.5, y: 0.05 },
      { x: 0.1, y: 0.5 },
      { x: 0.9, y: 0.5 },
      { x: 0.5, y: 0.95 },
    ]);
    expect([width, height]).toEqual([400, 400]);
    expect(isColor(pixels[0], [0, 0, 0])).toBe(true);
    expect(isColor(pixels[1], [255, 0, 0])).toBe(true);
    expect(isColor(pixels[2], [0, 0, 255])).toBe(true);
    expect(isColor(pixels[3], [0, 0, 0])).toBe(true);
  });

  test("contain with a transparent background leaves the padding transparent", async ({ page }) => {
    await openApp(page);
    await addFiles(page, [await makeImage(page, halves)]);
    await waitForReady(page, 1);
    await setExactSize(page, "400", "400");
    await page.getByText("Contain", { exact: true }).click();

    await process(page);
    await waitForComplete(page, 1);
    const { data } = await downloadVia(page, page.getByTestId("download-all"));
    const { pixels } = await samplePixels(page, data, "image/png", [{ x: 0.5, y: 0.05 }, { x: 0.1, y: 0.5 }]);
    expect(pixels[0][3]).toBe(0);
    expect(pixels[1][3]).toBe(255);
  });

  test("stretch forces the exact size and warns about distortion", async ({ page }) => {
    await openApp(page);
    await addFiles(page, [await makeImage(page, halves)]);
    await waitForReady(page, 1);
    await setExactSize(page, "300", "600");
    await page.getByText("Stretch", { exact: true }).click();
    await expect(page.getByText("Stretch changes the aspect ratio")).toBeVisible();

    await process(page);
    await waitForComplete(page, 1);
    const { data } = await downloadVia(page, page.getByTestId("download-all"));
    const { width, height, pixels } = await samplePixels(page, data, "image/png", [{ x: 0.1, y: 0.5 }, { x: 0.9, y: 0.5 }]);
    expect([width, height]).toEqual([300, 600]);
    // Nothing was cropped: both halves are still there.
    expect(isColor(pixels[0], [255, 0, 0])).toBe(true);
    expect(isColor(pixels[1], [0, 0, 255])).toBe(true);
  });

  test("percentage and enlarging", async ({ page }) => {
    await openApp(page);
    await addFiles(page, [await makeImage(page, { name: "small.png", width: 200, height: 100, type: "image/png" })]);
    await waitForReady(page, 1);

    await page.getByText("Percentage", { exact: true }).click();
    await page.getByRole("button", { name: "200%" }).click();
    await expect(page.getByTestId("output-summary")).toContainText("400 × 200");
    await expect(page.getByText("This image will be enlarged and may appear softer.")).toBeVisible();

    await process(page);
    await waitForComplete(page, 1);
    const { data } = await downloadVia(page, page.getByTestId("download-all"));
    expect(inspect(data)).toMatchObject({ width: 400, height: 200 });
  });

  test("downsizing uses the Lanczos resampler, bit for bit in every browser @cross-browser", async ({ page }) => {
    await openApp(page);
    // Noise has detail at every frequency, so any other filter (or the browser's own scaling) gives different bytes.
    const file = await makeImage(page, { name: "detail.png", width: 600, height: 300, type: "image/png", kind: "noise" });
    await addFiles(page, [file]);
    await waitForReady(page, 1);
    await page.getByLabel("Width", { exact: true }).fill("200");
    await process(page);
    await waitForComplete(page, 1);
    const { data } = await downloadVia(page, page.getByTestId("download-all"));

    const source = await readPixels(page, file.buffer, "image/png");
    const expected = new Uint8ClampedArray(200 * 100 * 4);
    resample(
      {
        source: { width: 600, height: 300 },
        region: { x: 0, y: 0, width: 600, height: 300 },
        target: { width: 200, height: 100 },
        sharpen: sharpenAmount(3),
      },
      {
        read: (x, y, width, height) => {
          const band = new Uint8ClampedArray(width * height * 4);
          for (let row = 0; row < height; row++) {
            const start = ((y + row) * 600 + x) * 4;
            band.set(source.pixels.subarray(start, start + width * 4), row * width * 4);
          }
          return band;
        },
        write: (y, _height, pixels) => expected.set(pixels, y * 200 * 4),
      },
    );

    const output = await readPixels(page, data, "image/png");
    expect([output.width, output.height]).toEqual([200, 100]);
    expect(Buffer.from(output.pixels).equals(Buffer.from(expected))).toBe(true);
  });

  test("a very large image downsizes correctly", async ({ page }) => {
    await openApp(page);
    // 24 MP source, 16× reduction: exercises staged downscaling.
    await addFiles(page, [await makeImage(page, { name: "huge.jpg", width: 6000, height: 4000, type: "image/jpeg", kind: "halves" })]);
    await waitForReady(page, 1);
    await page.getByLabel("Width", { exact: true }).fill("375");
    await page.getByLabel("Format").selectOption("png");
    await process(page);
    await waitForComplete(page, 1);

    const { data } = await downloadVia(page, page.getByTestId("download-all"));
    const { width, height, pixels } = await samplePixels(page, data, "image/png", [{ x: 0.25, y: 0.5 }, { x: 0.75, y: 0.5 }]);
    expect([width, height]).toEqual([375, 250]);
    expect(isColor(pixels[0], [255, 0, 0])).toBe(true);
    expect(isColor(pixels[1], [0, 0, 255])).toBe(true);
  });
});

test.describe("formats", () => {
  test("AVIF output is real AVIF @cross-browser", async ({ page }) => {
    await openApp(page);
    await addFiles(page, [await makeImage(page, { name: "photo.jpg", width: 640, height: 480, type: "image/jpeg" })]);
    await waitForReady(page, 1);
    await page.getByLabel("Format").selectOption("avif");
    await process(page);
    await waitForComplete(page, 1, 90_000);
    await expect(rows(page).first()).toContainText("AVIF");

    const { filename, data } = await downloadVia(page, page.getByTestId("download-all"));
    expect(filename).toBe("photo.avif");
    // An ISO-BMFF container with the avif brand — not a PNG wearing an .avif name.
    expect(inspect(data).format).toBe("avif");
  });

  test("WebP input is accepted and can be converted", async ({ page, browserName }) => {
    test.skip(browserName === "webkit", "WebKit cannot generate the WebP fixture");
    await openApp(page);
    await addFiles(page, [await makeImage(page, { name: "small.webp", width: 320, height: 240, type: "image/webp" })]);
    await waitForReady(page, 1);
    await expect(rows(page).first()).toContainText("WebP");
    await page.getByLabel("Format").selectOption("jpeg");
    await process(page);
    await waitForComplete(page, 1);
    const { data } = await downloadVia(page, page.getByTestId("download-all"));
    expect(inspect(data)).toMatchObject({ format: "jpeg", width: 320, height: 240 });
  });

  test("a PNG mislabeled as .jpg is detected from its bytes", async ({ page }) => {
    await openApp(page);
    const png = await makeImage(page, { name: "actually-png.jpg", width: 300, height: 200, type: "image/png" });
    await addFiles(page, [{ ...png, mimeType: "image/jpeg" }]);
    await waitForReady(page, 1);
    await expect(rows(page).first()).toContainText("PNG");
  });
});

test.describe("multiple outputs", () => {
  test("one image, two variants, a folder each in the ZIP", async ({ page }) => {
    await openApp(page);
    await addFiles(page, [await makeImage(page, { name: "hero.jpg", width: 1600, height: 900, type: "image/jpeg" })]);
    await waitForReady(page, 1);
    await page.getByRole("button", { name: "Advanced" }).click();

    await page.getByLabel("Width", { exact: true }).fill("800");
    await page.getByLabel("Format").selectOption("webp");
    await page.getByLabel("Output name").fill("medium");
    await page.getByRole("button", { name: "Add output" }).click();

    await page.getByLabel("Width", { exact: true }).fill("200");
    await page.getByLabel("Output name").fill("thumbnail");
    await page.getByRole("button", { name: "Add output" }).click();

    await process(page);
    await waitForComplete(page, 2);

    const { data } = await downloadVia(page, page.getByTestId("download-all"));
    const entries = unzip(data);
    expect(Object.keys(entries).sort()).toEqual(["medium/hero.webp", "thumbnail/hero.webp"]);
    expect(inspect(Buffer.from(entries["medium/hero.webp"]))).toMatchObject({ format: "webp", width: 800, height: 450 });
    expect(inspect(Buffer.from(entries["thumbnail/hero.webp"]))).toMatchObject({ format: "webp", width: 200, height: 113 });
  });
});
