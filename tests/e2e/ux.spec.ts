import { expect, test } from "@playwright/test";
import { addAnyImage, addFiles, downloadVia, inspect, makeImage, openApp, process, rows, type TestFile, waitForComplete, waitForReady } from "./helpers";

test.describe("cancellation", () => {
  test("cancel all stops the batch, and the images can be processed again", async ({ page }) => {
    await openApp(page);
    const files: TestFile[] = [];
    for (let i = 0; i < 8; i++) {
      files.push(await makeImage(page, { name: `photo-${i}.jpg`, width: 3000, height: 2000, type: "image/jpeg", kind: "noise", quality: 0.9 }));
    }
    await addFiles(page, files);
    await waitForReady(page, 8);

    // AVIF is slow enough that the batch is certainly still running when we cancel.
    await page.getByLabel("Format").selectOption("avif");
    await process(page);
    await expect(page.getByTestId("progress-text")).toBeVisible();
    await page.getByRole("button", { name: "Cancel all" }).click();

    // Nothing is left queued or running, and nothing completed behind our back afterwards.
    await expect(page.locator('[data-testid="job"][data-status="queued"], [data-testid="job"][data-status="processing"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="job"][data-status="cancelled"]').first()).toBeVisible();
    await expect(page.getByTestId("progress-text")).toBeHidden();
    const completedAfterCancel = await page.locator('[data-testid="job"][data-status="complete"]').count();
    await page.waitForTimeout(2500);
    expect(await page.locator('[data-testid="job"][data-status="complete"]').count()).toBe(completedAfterCancel);

    // The app (and its workers) are still healthy.
    await page.getByLabel("Format").selectOption("jpeg");
    await page.getByLabel("Width", { exact: true }).fill("300");
    await process(page);
    await waitForComplete(page, 8);
  });

  test("a single queued image can be cancelled and retried", async ({ page }) => {
    await openApp(page);
    const files: TestFile[] = [];
    for (let i = 0; i < 6; i++) {
      files.push(await makeImage(page, { name: `photo-${i}.jpg`, width: 2400, height: 1600, type: "image/jpeg", kind: "noise", quality: 0.9 }));
    }
    await addFiles(page, files);
    await waitForReady(page, 6);
    await page.getByLabel("Format").selectOption("avif");
    await process(page);

    const last = rows(page).last();
    await last.getByRole("button", { name: "Cancel" }).click();
    await expect(last).toContainText("Cancelled");
    await page.getByRole("button", { name: "Cancel all" }).click();

    await page.getByRole("button", { name: "Retry photo-5.jpg" }).click();
    await expect(last.locator('[data-testid="job"][data-status="complete"]')).toHaveCount(1, { timeout: 90_000 });
    await expect(last).toContainText("AVIF");
  });

  test("removing an image mid-run and clearing everything leave a clean slate", async ({ page }) => {
    await openApp(page);
    const files: TestFile[] = [];
    for (let i = 0; i < 4; i++) {
      files.push(await makeImage(page, { name: `photo-${i}.jpg`, width: 2000, height: 1500, type: "image/jpeg", kind: "noise" }));
    }
    await addFiles(page, files);
    await waitForReady(page, 4);
    await page.getByLabel("Format").selectOption("avif");
    await process(page);
    await page.getByRole("button", { name: "Remove photo-0.jpg" }).click();
    await expect(rows(page)).toHaveCount(3);

    // Removing everything asks once before it throws the session away.
    await page.getByRole("button", { name: "Remove all" }).click();
    await page.getByRole("button", { name: "Remove 3 images" }).click();
    await expect(rows(page)).toHaveCount(0);
    // With nothing open, the workspace is back to its empty state: no settings, nothing to press.
    await expect(page.getByRole("button", { name: /Choose images/ })).toBeVisible();
    await expect(page.getByTestId("process-button")).toHaveCount(0);
  });
});

test.describe("settings", () => {
  test("settings survive a reload, images do not", async ({ page }) => {
    await openApp(page);
    await addFiles(page, [await makeImage(page, { name: "a.jpg", width: 800, height: 600, type: "image/jpeg" })]);
    await waitForReady(page, 1);
    await page.getByLabel("Format").selectOption("webp");
    await page.getByLabel("Width", { exact: true }).fill("640");
    await page.getByLabel("Quality value").fill("70");

    await page.reload();
    // Privacy: nothing about the images themselves is restored.
    await expect(page.getByRole("button", { name: /Choose images/ })).toBeVisible();
    await expect(rows(page)).toHaveCount(0);

    await addAnyImage(page);
    await expect(page.getByLabel("Format")).toHaveValue("webp");
    await expect(page.getByLabel("Width", { exact: true })).toHaveValue("640");
    await expect(page.getByLabel("Quality value")).toHaveValue("70");
  });

  test("reset settings restores defaults without removing images", async ({ page }) => {
    await openApp(page);
    await addFiles(page, [await makeImage(page, { name: "a.jpg", width: 800, height: 600, type: "image/jpeg" })]);
    await waitForReady(page, 1);
    await page.getByLabel("Format").selectOption("png");
    await page.getByLabel("Width", { exact: true }).fill("100");

    await page.getByRole("button", { name: "Reset settings" }).click();
    await expect(page.getByLabel("Format")).toHaveValue("source");
    await expect(page.getByLabel("Width", { exact: true })).toHaveValue("800");
    await expect(rows(page)).toHaveCount(1);
  });

  test("URL parameters preconfigure the tool, and bad ones are ignored", async ({ page }) => {
    await openApp(page, "/app?width=1200&height=630&format=webp&quality=75");
    await addAnyImage(page);
    await expect(page.getByLabel("Width", { exact: true })).toHaveValue("1200");
    await expect(page.getByLabel("Height", { exact: true })).toHaveValue("630");
    await expect(page.getByLabel("Format")).toHaveValue("webp");
    await expect(page.getByLabel("Quality value")).toHaveValue("75");

    await openApp(page, "/app?width=99999999&format=%3Cscript%3E&quality=abc");
    await addAnyImage(page);
    await expect(page.getByLabel("Width", { exact: true })).toHaveValue("1200");
    await expect(page.getByLabel("Format")).toHaveValue("webp");
  });

  test("tool landing pages open preconfigured", async ({ page }) => {
    await openApp(page, "/compress-image");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Compress images");
    // The empty page says what it has set up; the settings themselves show once an image is open.
    await expect(page.getByText("Set up to compress under 1 MB, keeping dimensions.")).toBeVisible();
    await addAnyImage(page);
    await expect(page.getByLabel("File size", { exact: true })).toBeChecked();
    await expect(page.getByLabel("Make each image smaller than")).toHaveValue("1");
    await expect(page.getByLabel("Unit")).toHaveValue("MB");
    await expect(page.getByLabel("Compress only", { exact: true })).toBeChecked();

    // A target below 1 MB is shown in KB, not as a fraction of a megabyte.
    await openApp(page, "/reduce-image-file-size");
    await addAnyImage(page);
    await expect(page.getByLabel("Make each image smaller than")).toHaveValue("500");
    await expect(page.getByLabel("Unit")).toHaveValue("KB");
    await expect(page.getByLabel("Smart", { exact: true })).toBeChecked();

    const missing = await page.goto("/not-a-real-tool");
    expect(missing?.status()).toBe(404);
  });

  test("size presets, swap and saved presets", async ({ page }) => {
    await openApp(page);
    await addAnyImage(page);
    await page.getByLabel("Preset", { exact: true }).selectOption({ label: "Full HD · 1920 × 1080" });
    await expect(page.getByLabel("Width", { exact: true })).toHaveValue("1920");
    await expect(page.getByLabel("Height", { exact: true })).toHaveValue("1080");

    await page.getByRole("button", { name: "Swap width and height" }).click();
    await expect(page.getByLabel("Width", { exact: true })).toHaveValue("1080");
    await expect(page.getByLabel("Height", { exact: true })).toHaveValue("1920");

    await page.getByRole("button", { name: "Advanced" }).click();
    await page.getByLabel("Preset name").fill("Stories");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("1080 × 1920 · Fill")).toBeVisible();

    // Reset goes back to the image's own size.
    await page.getByRole("button", { name: "Reset settings" }).click();
    await expect(page.getByLabel("Width", { exact: true })).toHaveValue("800");
    await page.getByRole("button", { name: "Apply preset Stories" }).click();
    await expect(page.getByLabel("Width", { exact: true })).toHaveValue("1080");

    // Presets are stored locally and survive a reload.
    await page.reload();
    await addAnyImage(page);
    await expect(page.getByRole("button", { name: "Apply preset Stories" })).toBeVisible();
  });

  test("filename patterns and bulk rename", async ({ page }) => {
    await openApp(page);
    await addFiles(page, [
      await makeImage(page, { name: "IMG 0001.jpg", width: 400, height: 300, type: "image/jpeg" }),
      await makeImage(page, { name: "IMG 0002.jpg", width: 400, height: 300, type: "image/jpeg" }),
    ]);
    await waitForReady(page, 2);
    await page.getByLabel("Width", { exact: true }).fill("200");
    await page.getByRole("button", { name: "Advanced" }).click();

    await page.getByLabel("File names").selectOption("dimensions");
    await expect(page.getByText("IMG 0001-200x150.jpg")).toBeVisible();

    await page.getByLabel("File names").selectOption("rename");
    await page.getByLabel(/New name/).fill("wedding-photo");
    await process(page);
    await waitForComplete(page, 2);
    await expect(page.getByRole("button", { name: "Download wedding-photo-01.jpg" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Download wedding-photo-02.jpg" })).toBeVisible();
  });
});

test.describe("adding files", () => {
  test("drag and drop anywhere on the page", async ({ page }) => {
    await openApp(page);
    const file = await makeImage(page, { name: "dropped.png", width: 300, height: 200, type: "image/png" });

    const dataTransfer = await page.evaluateHandle(({ base64, name, type }) => {
      const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
      const transfer = new DataTransfer();
      transfer.items.add(new File([bytes], name, { type }));
      return transfer;
    }, { base64: file.buffer.toString("base64"), name: file.name, type: file.mimeType });

    await page.dispatchEvent("body", "dragenter", { dataTransfer });
    await expect(page.getByText("Drop images to add", { exact: true })).toBeVisible();
    await page.dispatchEvent("body", "dragover", { dataTransfer });
    await page.dispatchEvent("body", "drop", { dataTransfer });

    await waitForReady(page, 1);
    await expect(rows(page).first()).toContainText("dropped.png");
  });

  test("pasting an image adds it, pasting into a field does not", async ({ page }) => {
    await openApp(page);
    const file = await makeImage(page, { name: "pasted.png", width: 300, height: 200, type: "image/png" });
    const paste = (selector: string) =>
      page.evaluate(({ selector, base64 }) => {
        const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
        const clipboardData = new DataTransfer();
        clipboardData.items.add(new File([bytes], "image.png", { type: "image/png" }));
        document.querySelector(selector)!.dispatchEvent(new ClipboardEvent("paste", { clipboardData, bubbles: true, cancelable: true }));
      }, { selector, base64: file.buffer.toString("base64") });

    // On the empty workspace a paste is all it takes.
    await paste("body");
    await waitForReady(page, 1);

    await paste("#width");
    await page.waitForTimeout(300);
    await expect(rows(page)).toHaveCount(1);

    await paste("body");
    await waitForReady(page, 2);
  });

  test("the same file can be added twice", async ({ page }) => {
    await openApp(page);
    const file = await makeImage(page, { name: "twin.jpg", width: 300, height: 200, type: "image/jpeg" });
    await addFiles(page, [file]);
    await addFiles(page, [file]);
    await waitForReady(page, 2);
  });
});

test.describe("keyboard and accessibility basics", () => {
  test("the whole flow works from the keyboard", async ({ page }) => {
    await openApp(page);
    await addFiles(page, [await makeImage(page, { name: "a.jpg", width: 800, height: 600, type: "image/jpeg" })]);
    await waitForReady(page, 1);

    await page.getByLabel("Width", { exact: true }).focus();
    await page.keyboard.type("400");
    await page.keyboard.press("ControlOrMeta+Enter");
    await waitForComplete(page, 1);
    await expect(rows(page).first()).toContainText("400 × 300");

    // The primary action stays on screen on a laptop-sized window, even with every option open.
    await page.getByRole("button", { name: "Advanced" }).click();
    await expect(page.getByTestId("process-button")).toBeInViewport({ ratio: 1 });

    // Every control is a real, labelled form element or button.
    await expect(page.getByRole("button", { name: "Lock aspect ratio" })).toHaveAttribute("aria-pressed", "true");

    // With results for these settings, downloading is the main action and resizing steps back…
    await expect(page.getByTestId("process-button")).toHaveText("Resize again");
    await expect(page.getByTestId("download-all")).toHaveText("Download");
    // …until a setting changes: the results are kept, and Resize leads again.
    await page.getByLabel("Width", { exact: true }).fill("300");
    await expect(page.getByRole("button", { name: /^Resize 1 image$/ })).toBeEnabled();
    await expect(page.getByText("Results use previous settings.")).toBeVisible();
    await expect(page.getByTestId("download-all")).toHaveText("Download existing file");
    await expect(rows(page).first()).toContainText("400 × 300");
  });

  test("O and R switch the preview between original and result, but not while typing", async ({ page }) => {
    await openApp(page);
    await addAnyImage(page);
    const original = page.getByLabel("Original", { exact: true });
    const output = page.getByLabel("Output", { exact: true });
    await expect(output).toBeChecked();

    await page.locator("body").press("o");
    await expect(original).toBeChecked();
    await page.locator("body").press("r");
    await expect(output).toBeChecked();

    // In a text field the same keys are just typing.
    await page.getByRole("button", { name: "Advanced" }).click();
    await page.getByLabel("Preset name").fill("");
    await page.getByLabel("Preset name").pressSequentially("or");
    await expect(page.getByLabel("Preset name")).toHaveValue("or");
    await expect(output).toBeChecked();
  });

  test("crop can be moved with arrow keys", async ({ page }) => {
    await openApp(page);
    await addFiles(page, [await makeImage(page, { name: "halves.png", width: 1000, height: 500, type: "image/png", kind: "halves" })]);
    await waitForReady(page, 1);
    await page.getByRole("button", { name: "Lock aspect ratio" }).click();
    await page.getByLabel("Width", { exact: true }).fill("300");
    await page.getByLabel("Height", { exact: true }).fill("300");

    const canvas = page.getByTestId("preview-canvas");
    await canvas.focus();
    for (let i = 0; i < 6; i++) await page.keyboard.press("Shift+ArrowLeft");
    await expect(page.getByRole("button", { name: "Reset crop" })).toBeEnabled();
  });
});

test.describe("mobile", () => {
  test("the process button stays reachable and the flow works on a phone @mobile", async ({ page, isMobile }) => {
    test.skip(!isMobile, "phone layout only");
    await openApp(page);
    await addFiles(page, [await makeImage(page, { name: "phone.jpg", width: 1200, height: 1600, type: "image/jpeg" })]);
    await waitForReady(page, 1);

    // Numeric keyboard for dimension fields.
    await expect(page.getByLabel("Width", { exact: true })).toHaveAttribute("inputmode", "numeric");
    await page.getByLabel("Width", { exact: true }).fill("600");

    const button = page.getByTestId("process-button");
    await expect(button).toBeInViewport();
    const box = (await button.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);

    await button.click();
    await waitForComplete(page, 1);
    const { data } = await downloadVia(page, page.getByTestId("download-all"));
    expect(inspect(data)).toMatchObject({ width: 600, height: 800 });

    // No horizontal scrolling at phone width.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    // The action bar stays on screen at the end of the page without covering the last thing on it.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(page.getByTestId("download-all")).toBeInViewport();
    const lastLink = (await page.getByRole("contentinfo").getByRole("link", { name: "Terms" }).boundingBox())!;
    const bar = (await page.locator(".action-dock").boundingBox())!;
    expect(lastLink.y + lastLink.height).toBeLessThanOrEqual(bar.y);
  });
});

test.describe("privacy", () => {
  test("processing makes no network requests", async ({ page }) => {
    await openApp(page);
    await page.waitForLoadState("networkidle");

    const requests: string[] = [];
    page.on("request", (request) => {
      const url = request.url();
      if (!url.startsWith("blob:") && !url.startsWith("data:")) requests.push(`${request.method()} ${url}`);
    });

    await addFiles(page, [await makeImage(page, { name: "private.jpg", width: 1000, height: 800, type: "image/jpeg" })]);
    await waitForReady(page, 1);
    await page.getByLabel("Width", { exact: true }).fill("500");
    await process(page);
    await waitForComplete(page, 1);

    // The only thing fetched after load is the app's own code (the worker script) — never a POST, never image data.
    expect(requests.filter((request) => !request.startsWith("GET "))).toEqual([]);
    expect(requests.every((request) => request.includes("/_next/static/"))).toBe(true);
  });
});
