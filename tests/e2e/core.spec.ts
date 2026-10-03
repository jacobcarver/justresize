import { expect, test } from "@playwright/test";
import {
  addFiles,
  downloadVia,
  inspect,
  makeImage,
  openApp,
  process,
  rows,
  type TestFile,
  unzip,
  waitForComplete,
  waitForReady,
} from "./helpers";

test.describe("single image", () => {
  test("resize by width, convert to WebP, download @cross-browser @mobile", async ({ page }) => {
    await openApp(page);
    await addFiles(page, [await makeImage(page, { name: "vacation-photo.jpg", width: 1600, height: 1200, type: "image/jpeg" })]);
    await waitForReady(page, 1);
    await expect(rows(page).first()).toContainText("1600 × 1200");

    // Ratio lock is on by default: typing a width recalculates the height.
    await page.getByLabel("Width", { exact: true }).fill("800");
    await expect(page.getByLabel("Height", { exact: true })).toHaveValue("600");

    await page.getByLabel("Format").selectOption("webp");
    await expect(page.getByTestId("output-summary")).toContainText("800 × 600 WebP");

    await process(page);
    await waitForComplete(page, 1);
    await expect(rows(page).first()).toContainText("800 × 600");
    await expect(rows(page).first()).toContainText("WebP");

    const { filename, data } = await downloadVia(page, page.getByRole("button", { name: /^Download vacation-photo\.webp/ }));
    expect(filename).toBe("vacation-photo.webp");
    expect(inspect(data)).toMatchObject({ format: "webp", width: 800, height: 600 });
  });

  test("starts at original dimensions and the original format", async ({ page }) => {
    await openApp(page);
    await addFiles(page, [await makeImage(page, { name: "logo.png", width: 640, height: 480, type: "image/png" })]);
    await waitForReady(page, 1);
    await expect(page.getByLabel("Width", { exact: true })).toHaveValue("640");
    await expect(page.getByLabel("Height", { exact: true })).toHaveValue("480");

    await process(page);
    await waitForComplete(page, 1);
    const { filename, data } = await downloadVia(page, page.getByTestId("download-all"));
    expect(filename).toBe("logo.png");
    expect(inspect(data)).toMatchObject({ format: "png", width: 640, height: 480 });
  });

  test("processing again replaces the previous result", async ({ page }) => {
    await openApp(page);
    await addFiles(page, [await makeImage(page, { name: "a.jpg", width: 800, height: 600, type: "image/jpeg" })]);
    await waitForReady(page, 1);

    await page.getByLabel("Width", { exact: true }).fill("400");
    await process(page);
    await waitForComplete(page, 1);
    await expect(rows(page).first()).toContainText("400 × 300");

    await page.getByLabel("Width", { exact: true }).fill("200");
    await process(page);
    await expect(rows(page).first()).toContainText("200 × 150");
    await expect(page.getByTestId("job")).toHaveCount(1);
  });
});

test.describe("batch", () => {
  test("processes several images independently and downloads a ZIP @cross-browser", async ({ page }) => {
    await openApp(page);
    const files = [
      await makeImage(page, { name: "landscape.jpg", width: 2000, height: 1000, type: "image/jpeg" }),
      await makeImage(page, { name: "portrait.jpg", width: 900, height: 1800, type: "image/jpeg" }),
      await makeImage(page, { name: "square.png", width: 1200, height: 1200, type: "image/png" }),
      await makeImage(page, { name: "tiny.png", width: 40, height: 30, type: "image/png" }),
      // Same name as the first file: the ZIP must not lose either.
      await makeImage(page, { name: "landscape.jpg", width: 1500, height: 500, type: "image/jpeg" }),
    ];
    await addFiles(page, files);
    await waitForReady(page, 5);

    await page.getByText("Max size", { exact: true }).click();
    await page.getByLabel("Max width").fill("500");
    await page.getByLabel("Max height").fill("500");
    await page.getByLabel("Format").selectOption("jpeg");

    await expect(page.getByTestId("process-button")).toHaveText("Resize 5 images");
    await process(page);
    await waitForComplete(page, 5);
    await expect(page.getByTestId("batch-summary")).toContainText("5 images ready");

    const { filename, data } = await downloadVia(page, page.getByTestId("download-all"));
    expect(filename).toBe("justresize-5-images.zip");
    const entries = unzip(data);
    expect(Object.keys(entries).sort()).toEqual(["landscape-2.jpg", "landscape.jpg", "portrait.jpg", "square.jpg", "tiny.jpg"]);

    const sizes = Object.fromEntries(
      Object.entries(entries).map(([name, bytes]) => {
        const info = inspect(Buffer.from(bytes));
        return [name, `${info.format} ${info.width}x${info.height}`];
      }),
    );
    expect(sizes).toEqual({
      "landscape.jpg": "jpeg 500x250",
      "landscape-2.jpg": "jpeg 500x167",
      "portrait.jpg": "jpeg 250x500",
      "square.jpg": "jpeg 500x500",
      // Smaller than the box: a maximum never enlarges.
      "tiny.jpg": "jpeg 40x30",
    });
  });

  test("files added during a run wait until asked for", async ({ page }) => {
    await openApp(page);
    await addFiles(page, [await makeImage(page, { name: "first.jpg", width: 600, height: 400, type: "image/jpeg" })]);
    await waitForReady(page, 1);
    await process(page);
    await waitForComplete(page, 1);

    await addFiles(page, [await makeImage(page, { name: "second.jpg", width: 600, height: 400, type: "image/jpeg" })]);
    await waitForReady(page, 2);
    // The new file is not processed automatically.
    await expect(page.getByTestId("job")).toHaveCount(1);
    await process(page);
    await waitForComplete(page, 2);
  });
});

test.describe("large batches", () => {
  test("50 photos: fit within 1600, WebP at quality 82, one ZIP — while the page stays usable", async ({ page }) => {
    test.setTimeout(180_000);
    await openApp(page);

    // A few distinct photos, repeated under 50 different names.
    const shapes = [
      { width: 3200, height: 2400 },
      { width: 2400, height: 3200 },
      { width: 4000, height: 2250 },
      { width: 1200, height: 1200 },
      { width: 3000, height: 2000 },
    ];
    const originals: TestFile[] = [];
    for (const [index, shape] of shapes.entries()) {
      originals.push(await makeImage(page, { name: `shape-${index}.jpg`, ...shape, type: "image/jpeg", kind: index % 2 ? "gradient" : "noise", quality: 0.85 }));
    }
    const files = Array.from({ length: 50 }, (_, index) => ({ ...originals[index % originals.length], name: `IMG_${String(index + 1).padStart(4, "0")}.jpg` }));
    // Added in several goes, the way people actually do it (and under Playwright's upload size cap).
    for (let start = 0; start < files.length; start += 10) await addFiles(page, files.slice(start, start + 10));
    await waitForReady(page, 50);

    await page.getByText("Max size", { exact: true }).click();
    await page.getByRole("button", { name: "1600", exact: true }).click();
    await page.getByLabel("Format").selectOption("webp");
    await page.getByLabel("Quality value").fill("82");
    await expect(page.getByTestId("process-button")).toHaveText("Resize 50 images");
    await process(page);

    // The UI keeps responding mid-batch: progress is shown and controls still work.
    await expect(page.getByTestId("progress-text")).toContainText("of 50 done");
    await page.getByRole("button", { name: "Advanced" }).click();
    await expect(page.getByLabel("File names")).toBeVisible();
    // Changing settings now must not affect the jobs already queued.
    await page.getByLabel("Quality value").fill("10");
    await page.getByLabel("Format").selectOption("jpeg");

    await waitForComplete(page, 50, 150_000);
    await expect(page.getByTestId("batch-summary")).toContainText("50 images ready");
    await expect(page.getByTestId("batch-summary")).toContainText("smaller");

    const { filename, data } = await downloadVia(page, page.getByTestId("download-all"));
    expect(filename).toBe("justresize-50-images.zip");
    const entries = unzip(data);
    const names = Object.keys(entries);
    expect(names).toHaveLength(50);
    expect(new Set(names).size).toBe(50);
    for (const [name, bytes] of Object.entries(entries)) {
      const info = inspect(Buffer.from(bytes));
      // Still WebP (the snapshot taken at start), never larger than 1600 on either side.
      expect(name.endsWith(".webp")).toBe(true);
      expect(info.format).toBe("webp");
      expect(Math.max(info.width!, info.height!)).toBeLessThanOrEqual(1600);
    }
    expect(inspect(Buffer.from(entries["IMG_0001.webp"]))).toMatchObject({ width: 1600, height: 1200 });
    expect(inspect(Buffer.from(entries["IMG_0004.webp"]))).toMatchObject({ width: 1200, height: 1200 });
  });
});

test.describe("errors", () => {
  test("bad files are explained and do not stop the good ones @cross-browser", async ({ page }) => {
    await openApp(page);
    const good = await makeImage(page, { name: "good.jpg", width: 800, height: 600, type: "image/jpeg" });
    await addFiles(page, [
      { name: "report.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.7 not really a pdf but close enough") },
      { name: "corrupted.jpg", mimeType: "image/jpeg", buffer: Buffer.from("this is definitely not jpeg data ".repeat(40)) },
      { name: "truncated.jpg", mimeType: "image/jpeg", buffer: good.buffer.subarray(0, 300) },
      good,
    ]);

    await expect(rows(page)).toHaveCount(4);
    await expect(rows(page).nth(0)).toContainText("PDF files aren't supported");
    await expect(rows(page).nth(1)).toContainText("couldn't be read as an image");
    await expect(rows(page).nth(2)).toContainText("couldn't be read as an image");
    await waitForReady(page, 1);

    // The app is still fully usable.
    await expect(page.getByTestId("process-button")).toHaveText("Resize 1 image");
    await process(page);
    await waitForComplete(page, 1);

    // Bad rows can be dismissed.
    await page.getByRole("button", { name: "Remove report.pdf" }).click();
    await expect(rows(page)).toHaveCount(3);
  });

  test("invalid and absurd dimensions block processing with a reason", async ({ page }) => {
    await openApp(page);
    await addFiles(page, [await makeImage(page, { name: "a.jpg", width: 800, height: 600, type: "image/jpeg" })]);
    await waitForReady(page, 1);

    const width = page.getByLabel("Width", { exact: true });
    await width.fill("0");
    await expect(page.getByTestId("process-button")).toBeDisabled();
    await expect(page.getByTestId("process-reason")).toHaveText("Width must be at least 1 px.");

    await width.fill("999999");
    await expect(page.getByTestId("process-button")).toBeDisabled();
    await expect(page.getByTestId("process-reason")).toContainText("at most 32,767");

    await width.fill("400");
    await expect(page.getByTestId("process-button")).toBeEnabled();
  });

  test("animated GIFs are rejected with an explanation", async ({ page }) => {
    await openApp(page);
    const frame = [0x21, 0xf9, 4, 0, 0, 0, 0, 0, 0x2c, 0, 0, 0, 0, 2, 0, 2, 0, 0, 2, 2, 0x4c, 0x01, 0];
    const bytes = [...Buffer.from("GIF89a"), 2, 0, 2, 0, 0x80, 0, 0, 0, 0, 0, 255, 255, 255, ...frame, ...frame, 0x3b];
    await addFiles(page, [{ name: "dance.gif", mimeType: "image/gif", buffer: Buffer.from(bytes) }]);
    await expect(rows(page).first()).toContainText("Animated GIFs aren't supported yet");
  });
});
