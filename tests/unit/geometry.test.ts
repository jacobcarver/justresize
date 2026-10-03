import { describe, expect, it } from "vitest";
import {
  calculateContain,
  calculateCropRegion,
  calculateDimensionsFromHeight,
  calculateDimensionsFromWidth,
  calculateInside,
  calculatePercentage,
  computeRenderPlan,
  focalPointFromCrop,
  type GeometryConfig,
  resolveOutputSize,
  scaleRenderPlan,
  validateOutputSize,
  validateSourceSize,
} from "@/lib/image/geometry";
import { downscaleSteps } from "@/lib/image/resize";

const source = { width: 4000, height: 3000 };

function config(overrides: Partial<GeometryConfig>): GeometryConfig {
  return {
    resizeMode: "dimensions",
    maintainAspectRatio: true,
    fit: "cover",
    crop: { x: 0.5, y: 0.5, zoom: 1 },
    ...overrides,
  };
}

describe("aspect-ratio helpers", () => {
  it("derives height from width", () => {
    expect(calculateDimensionsFromWidth(source, 1000)).toEqual({ width: 1000, height: 750 });
  });

  it("derives width from height", () => {
    expect(calculateDimensionsFromHeight(source, 750)).toEqual({ width: 1000, height: 750 });
  });

  it("never rounds a dimension down to zero", () => {
    expect(calculateDimensionsFromWidth({ width: 5000, height: 2 }, 10)).toEqual({ width: 10, height: 1 });
  });
});

describe("percentage", () => {
  it("scales 4000×3000 at 50% to 2000×1500", () => {
    expect(calculatePercentage(source, 50)).toEqual({ width: 2000, height: 1500 });
  });

  it("enlarges above 100%", () => {
    expect(calculatePercentage(source, 150)).toEqual({ width: 6000, height: 4500 });
  });
});

describe("inside (fit within)", () => {
  it("fits 4000×3000 into 1920×1920 as 1920×1440", () => {
    expect(calculateInside(source, { width: 1920, height: 1920 }, { allowUpscale: false })).toEqual({
      width: 1920,
      height: 1440,
    });
  });

  it("is limited by the tighter side", () => {
    expect(calculateInside(source, { width: 1920, height: 300 }, { allowUpscale: false })).toEqual({
      width: 400,
      height: 300,
    });
  });

  it("supports a single constraint", () => {
    expect(calculateInside(source, { height: 600 }, { allowUpscale: false })).toEqual({ width: 800, height: 600 });
  });

  it("does not enlarge when upscaling is not allowed", () => {
    expect(calculateInside({ width: 800, height: 600 }, { width: 1920, height: 1920 }, { allowUpscale: false })).toEqual({
      width: 800,
      height: 600,
    });
  });

  it("enlarges when upscaling is allowed", () => {
    expect(calculateInside({ width: 800, height: 600 }, { width: 1600, height: 1600 }, { allowUpscale: true })).toEqual({
      width: 1600,
      height: 1200,
    });
  });
});

describe("contain", () => {
  it("centres 4000×3000 on a 1000×1000 canvas as 1000×750 at y=125", () => {
    expect(calculateContain(source, { width: 1000, height: 1000 })).toEqual({ x: 0, y: 125, width: 1000, height: 750 });
  });

  it("pads the sides for a portrait source on a landscape canvas", () => {
    expect(calculateContain({ width: 1000, height: 2000 }, { width: 800, height: 400 })).toEqual({
      x: 300,
      y: 0,
      width: 200,
      height: 400,
    });
  });
});

describe("cover / crop region", () => {
  it("crops 4000×3000 to a centred 3000×3000 square for a 1000×1000 output", () => {
    expect(
      calculateCropRegion({ sourceDimensions: source, outputDimensions: { width: 1000, height: 1000 } }),
    ).toEqual({ x: 500, y: 0, width: 3000, height: 3000 });
  });

  it("crops the sides for a 1080×1920 output", () => {
    const crop = calculateCropRegion({ sourceDimensions: source, outputDimensions: { width: 1080, height: 1920 } });
    expect(crop.height).toBe(3000);
    expect(crop.width).toBeCloseTo(1687.5);
    expect(crop.x).toBeCloseTo((4000 - 1687.5) / 2);
    expect(crop.y).toBe(0);
  });

  it("follows the focal point and clamps to the image", () => {
    const output = { width: 1000, height: 1000 };
    expect(calculateCropRegion({ sourceDimensions: source, outputDimensions: output, focalPoint: { x: 0, y: 0.5 } }).x).toBe(0);
    expect(calculateCropRegion({ sourceDimensions: source, outputDimensions: output, focalPoint: { x: 1, y: 0.5 } }).x).toBe(1000);
    expect(calculateCropRegion({ sourceDimensions: source, outputDimensions: output, focalPoint: { x: 0.25, y: 0.5 } }).x).toBe(0);
    expect(calculateCropRegion({ sourceDimensions: source, outputDimensions: output, focalPoint: { x: 0.6, y: 0.5 } }).x).toBe(900);
  });

  it("zoom shrinks the crop window around the focal point", () => {
    const crop = calculateCropRegion({
      sourceDimensions: source,
      outputDimensions: { width: 1000, height: 1000 },
      zoom: 2,
    });
    expect(crop).toEqual({ x: 1250, y: 750, width: 1500, height: 1500 });
  });

  it("round-trips through focalPointFromCrop", () => {
    const output = { width: 1000, height: 1000 };
    const crop = calculateCropRegion({ sourceDimensions: source, outputDimensions: output, focalPoint: { x: 0.9, y: 0.2 } });
    const focal = focalPointFromCrop(source, crop);
    expect(calculateCropRegion({ sourceDimensions: source, outputDimensions: output, focalPoint: focal })).toEqual(crop);
  });
});

describe("resolveOutputSize", () => {
  it("keeps original dimensions when nothing is set", () => {
    expect(resolveOutputSize(source, config({}))).toEqual(source);
  });

  it("locked width: height follows the source ratio", () => {
    expect(resolveOutputSize(source, config({ width: 1200 }))).toEqual({ width: 1200, height: 900 });
  });

  it("locked height: width follows the source ratio", () => {
    expect(resolveOutputSize(source, config({ height: 800 }))).toEqual({ width: 1067, height: 800 });
  });

  it("exact box when both dimensions are given", () => {
    expect(resolveOutputSize(source, config({ width: 1200, height: 800, maintainAspectRatio: false }))).toEqual({
      width: 1200,
      height: 800,
    });
  });

  it("locked width with an aspect-ratio preset produces that ratio", () => {
    expect(resolveOutputSize(source, config({ width: 1600, aspectRatio: { w: 16, h: 9 } }))).toEqual({
      width: 1600,
      height: 900,
    });
  });

  it("ratio only: cover trims to the largest box of that ratio", () => {
    expect(resolveOutputSize(source, config({ aspectRatio: { w: 1, h: 1 } }))).toEqual({ width: 3000, height: 3000 });
    expect(resolveOutputSize(source, config({ aspectRatio: { w: 16, h: 9 } }))).toEqual({ width: 4000, height: 2250 });
  });

  it("ratio only: contain pads out to the smallest box of that ratio", () => {
    expect(resolveOutputSize(source, config({ aspectRatio: { w: 1, h: 1 }, fit: "contain" }))).toEqual({
      width: 4000,
      height: 4000,
    });
  });

  it("inside fit returns the fitted size, not the box", () => {
    expect(
      resolveOutputSize(source, config({ width: 1000, height: 1000, maintainAspectRatio: false, fit: "inside" })),
    ).toEqual({ width: 1000, height: 750 });
  });

  it("max-dimensions never enlarges", () => {
    const max = config({ resizeMode: "max-dimensions", width: 1920, height: 1920 });
    expect(resolveOutputSize(source, max)).toEqual({ width: 1920, height: 1440 });
    expect(resolveOutputSize({ width: 640, height: 480 }, max)).toEqual({ width: 640, height: 480 });
  });

  it("percentage mode", () => {
    expect(resolveOutputSize(source, config({ resizeMode: "percentage", percentage: 25 }))).toEqual({
      width: 1000,
      height: 750,
    });
  });

  it("target-filesize mode keeps dimensions", () => {
    expect(resolveOutputSize(source, config({ resizeMode: "target-filesize", width: 100 }))).toEqual(source);
  });

  it("returns plain sizes even when given a richer object", () => {
    const decoded = { width: 800, height: 600, source: { bitmap: true }, close: () => {} };
    const modes = [
      config({}),
      config({ resizeMode: "target-filesize" }),
      config({ resizeMode: "max-dimensions", width: 5000 }),
      config({ resizeMode: "percentage", percentage: undefined }),
    ];
    for (const mode of modes) {
      expect(Object.keys(resolveOutputSize(decoded, mode)).sort()).toEqual(["height", "width"]);
      expect(Object.keys(computeRenderPlan(decoded, mode).canvas).sort()).toEqual(["height", "width"]);
    }
  });

  it("treats zero, negative and NaN dimensions as unset", () => {
    expect(resolveOutputSize(source, config({ width: 0 }))).toEqual(source);
    expect(resolveOutputSize(source, config({ width: -5, height: Number.NaN }))).toEqual(source);
  });
});

describe("computeRenderPlan", () => {
  it("cover crops and fills the canvas", () => {
    const plan = computeRenderPlan(source, config({ width: 1000, height: 1000, maintainAspectRatio: false }));
    expect(plan.canvas).toEqual({ width: 1000, height: 1000 });
    expect(plan.src).toEqual({ x: 500, y: 0, width: 3000, height: 3000 });
    expect(plan.dst).toEqual({ x: 0, y: 0, width: 1000, height: 1000 });
    expect(plan.padded).toBe(false);
    expect(plan.upscaled).toBe(false);
  });

  it("contain keeps the whole source and pads", () => {
    const plan = computeRenderPlan(
      source,
      config({ width: 1000, height: 1000, maintainAspectRatio: false, fit: "contain" }),
    );
    expect(plan.src).toEqual({ x: 0, y: 0, width: 4000, height: 3000 });
    expect(plan.dst).toEqual({ x: 0, y: 125, width: 1000, height: 750 });
    expect(plan.padded).toBe(true);
  });

  it("stretch maps the whole source onto the whole canvas", () => {
    const plan = computeRenderPlan(
      source,
      config({ width: 1000, height: 1000, maintainAspectRatio: false, fit: "stretch" }),
    );
    expect(plan.src).toEqual({ x: 0, y: 0, width: 4000, height: 3000 });
    expect(plan.dst).toEqual({ x: 0, y: 0, width: 1000, height: 1000 });
  });

  it("a single locked dimension never crops, even when rounding shifts the ratio", () => {
    const plan = computeRenderPlan(source, config({ width: 1001 }));
    expect(plan.canvas).toEqual({ width: 1001, height: 751 });
    expect(plan.src).toEqual({ x: 0, y: 0, width: 4000, height: 3000 });
    expect(plan.padded).toBe(false);
  });

  it("flags upscaling", () => {
    expect(computeRenderPlan(source, config({ width: 8000 })).upscaled).toBe(true);
    expect(computeRenderPlan(source, config({ resizeMode: "percentage", percentage: 200 })).upscaled).toBe(true);
    expect(computeRenderPlan(source, config({ width: 2000 })).upscaled).toBe(false);
  });

  it("applies the crop focal point from the config", () => {
    const plan = computeRenderPlan(
      source,
      config({ width: 1000, height: 1000, maintainAspectRatio: false, crop: { x: 0, y: 0.5, zoom: 1 } }),
    );
    expect(plan.src.x).toBe(0);
  });
});

describe("scaleRenderPlan", () => {
  it("scales canvas and destination, leaves the source crop alone", () => {
    const plan = computeRenderPlan(source, config({ width: 1000, height: 1000, maintainAspectRatio: false }));
    const half = scaleRenderPlan(plan, 0.5);
    expect(half.canvas).toEqual({ width: 500, height: 500 });
    expect(half.dst).toEqual({ x: 0, y: 0, width: 500, height: 500 });
    expect(half.src).toEqual(plan.src);
  });

  it("keeps padding centred", () => {
    const plan = computeRenderPlan(
      source,
      config({ width: 1000, height: 1000, maintainAspectRatio: false, fit: "contain" }),
    );
    expect(scaleRenderPlan(plan, 0.5).dst).toEqual({ x: 0, y: 63, width: 500, height: 375 });
  });
});

describe("safety limits", () => {
  it("accepts normal sizes", () => {
    expect(validateOutputSize({ width: 1920, height: 1080 })).toBeNull();
  });

  it("rejects absurd output sizes with a readable message", () => {
    const error = validateOutputSize({ width: 192000, height: 108000 });
    expect(error?.category).toBe("output_too_large");
    expect(error?.message).toContain("192,000 × 108,000");
  });

  it("rejects outputs whose area is too large even when each side is allowed", () => {
    expect(validateOutputSize({ width: 20000, height: 20000 })?.category).toBe("output_too_large");
  });

  it("rejects zero and NaN", () => {
    expect(validateOutputSize({ width: 0, height: 100 })?.category).toBe("invalid_config");
    expect(validateOutputSize({ width: Number.NaN, height: 100 })?.category).toBe("invalid_config");
  });

  it("rejects pathological sources", () => {
    expect(validateSourceSize({ width: 48000, height: 32000 })?.message).toBe(
      "This image is 48,000 × 32,000 pixels and exceeds the current browser processing limit.",
    );
    expect(validateSourceSize({ width: 8000, height: 6000 })).toBeNull();
  });
});

describe("progressive downscale steps", () => {
  it("does not stage small reductions", () => {
    expect(downscaleSteps({ width: 2000, height: 1500 }, { width: 1200, height: 900 })).toEqual([]);
  });

  it("halves 8000 → 1000 in stages", () => {
    expect(downscaleSteps({ width: 8000, height: 6000 }, { width: 1000, height: 750 })).toEqual([
      { width: 4000, height: 3000 },
      { width: 2000, height: 1500 },
    ]);
  });

  it("never steps below the target and always terminates", () => {
    const steps = downscaleSteps({ width: 30000, height: 3 }, { width: 10, height: 1 });
    expect(steps.length).toBeLessThan(20);
    for (const step of steps) {
      expect(step.width).toBeGreaterThanOrEqual(10);
      expect(step.height).toBeGreaterThanOrEqual(1);
    }
  });

  it("stages each axis independently for stretch", () => {
    expect(downscaleSteps({ width: 4000, height: 1000 }, { width: 500, height: 900 })).toEqual([
      { width: 2000, height: 1000 },
      { width: 1000, height: 1000 },
    ]);
  });
});
