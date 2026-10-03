import { describe, expect, it } from "vitest";
import { formatBytes, formatSizeChange, fromBytes, KB, MB, naturalUnit, parseByteString, toBytes } from "@/lib/utils/bytes";

describe("formatBytes", () => {
  it("formats bytes, KB, MB and GB", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(284 * KB)).toBe("284 KB");
    expect(formatBytes(1488973)).toBe("1.42 MB");
    expect(formatBytes(5.8 * MB)).toBe("5.8 MB");
    expect(formatBytes(183 * MB)).toBe("183 MB");
    expect(formatBytes(2.5 * 1024 * MB)).toBe("2.5 GB");
  });

  it("keeps trailing zeros that are part of the number", () => {
    expect(formatBytes(10 * KB)).toBe("10 KB");
    expect(formatBytes(500 * KB)).toBe("500 KB");
    expect(formatBytes(100 * MB)).toBe("100 MB");
    expect(formatBytes(20 * MB)).toBe("20 MB");
    expect(formatBytes(2 * MB)).toBe("2 MB");
    expect(formatBytes(1.5 * MB)).toBe("1.5 MB");
  });

  it("never shows 1024 KB", () => {
    expect(formatBytes(MB - 1)).toBe("1 MB");
  });

  it("handles invalid input", () => {
    expect(formatBytes(Number.NaN)).toBe("—");
    expect(formatBytes(-1)).toBe("—");
  });
});

describe("unit conversion", () => {
  it("converts to and from bytes using binary units", () => {
    expect(toBytes(500, "KB")).toBe(512000);
    expect(toBytes(2, "MB")).toBe(2097152);
    expect(fromBytes(2097152, "MB")).toBe(2);
  });

  it("picks a natural unit", () => {
    expect(naturalUnit(500 * KB)).toBe("KB");
    expect(naturalUnit(MB)).toBe("MB");
  });
});

describe("formatSizeChange", () => {
  it("reports a reduction as a percentage", () => {
    expect(formatSizeChange(5.8 * MB, 284 * KB)).toBe("95% smaller");
    expect(formatSizeChange(1000, 952)).toBe("4.8% smaller");
    expect(formatSizeChange(1000, 400)).toBe("60% smaller");
    expect(formatSizeChange(1000, 900)).toBe("10% smaller");
    expect(formatSizeChange(1000, 950)).toBe("5% smaller");
  });

  it("reports growth as a plain difference, never as savings", () => {
    expect(formatSizeChange(100 * KB, 118 * KB)).toBe("+18 KB");
  });

  it("handles equal sizes and never claims 100%", () => {
    expect(formatSizeChange(1000, 1000)).toBe("Same size");
    expect(formatSizeChange(10 * MB, 1)).toBe("99.9% smaller");
    // 99.5% and up used to round to "100%".
    expect(formatSizeChange(3.72 * MB, 18 * KB)).toBe("99.5% smaller");
    expect(formatSizeChange(1000, 4)).toBe("99.6% smaller");
    expect(formatSizeChange(1000, 6)).toBe("99% smaller");
  });

  it("never reports a real saving as 0%", () => {
    expect(formatSizeChange(10 * MB, 10 * MB - 1)).toBe("Under 0.1% smaller");
    expect(formatSizeChange(1000, 999)).toBe("0.1% smaller");
  });
});

describe("parseByteString", () => {
  it("parses common spellings", () => {
    expect(parseByteString("500kb")).toBe(500 * KB);
    expect(parseByteString("1.5 MB")).toBe(1.5 * MB);
    expect(parseByteString("2m")).toBe(2 * MB);
    expect(parseByteString("300K")).toBe(300 * KB);
  });

  it("rejects junk", () => {
    expect(parseByteString("")).toBeNull();
    expect(parseByteString("abc")).toBeNull();
    expect(parseByteString("-5mb")).toBeNull();
    expect(parseByteString("0kb")).toBeNull();
    expect(parseByteString("5 gb")).toBeNull();
  });
});
