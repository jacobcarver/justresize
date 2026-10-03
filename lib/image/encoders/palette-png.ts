/**
 * Palette PNG: the canvas pixels reduced to a limited set of colours and
 * written as an indexed PNG. Used only when a file-size target cannot be met
 * losslessly; reducing colours keeps dimensions (and text) intact.
 */
import { PALETTE_TUNING } from "@/lib/config/limits";
import { type AnyCanvas, getContext2D } from "../canvas";
import { encodeIndexedPng } from "../png";
import { quantize } from "../quantize";

export interface PaletteEncodeResult {
  blob: Blob;
  /** Colours in the written palette. */
  colors: number;
  /** True when the image had few enough colours to keep every one of them. */
  lossless: boolean;
}

export function encodePalettePng(canvas: AnyCanvas, maxColors: number): PaletteEncodeResult {
  const { width, height } = canvas;
  const pixels = getContext2D(canvas).getImageData(0, 0, width, height).data;
  const image = quantize(pixels, width, height, maxColors, { dither: PALETTE_TUNING.dither });
  const bytes = encodeIndexedPng({ width, height, ...image });
  return { blob: new Blob([bytes], { type: "image/png" }), colors: image.palette.length / 4, lossless: image.lossless };
}
