import type { BackgroundConfig, OutputFormat } from "@/types";
import type { AnyContext2D } from "./canvas";
import { OUTPUT_FORMATS } from "./formats";

/** True when any pixel is not fully opaque. Intended for thumbnail-sized canvases. */
export function hasTransparentPixels(context: AnyContext2D, width: number, height: number): boolean {
  const { data } = context.getImageData(0, 0, width, height);
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) return true;
  }
  return false;
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/**
 * The colour to paint under the image, or null to leave the canvas transparent.
 *
 * Formats without alpha always get a solid fill — white unless the user chose
 * a colour — so transparent areas never turn black by accident.
 */
export function resolveBackground(background: BackgroundConfig, format: OutputFormat): string | null {
  if (background.type === "color") {
    return HEX_COLOR.test(background.color) ? background.color : "#ffffff";
  }
  return OUTPUT_FORMATS[format].supportsTransparency ? null : "#ffffff";
}
