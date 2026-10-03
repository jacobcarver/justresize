import { describe, expect, it } from "vitest";
import {
  dedupeFilenames,
  formatFilename,
  padIndex,
  sanitizeFilenamePart,
  splitFilename,
  toFolderName,
} from "@/lib/files/naming";

const context = { name: "vacation-photo", width: 1200, height: 800, format: "webp" as const, index: 3, total: 12 };

describe("splitFilename", () => {
  it("splits name and extension", () => {
    expect(splitFilename("vacation-photo.JPG")).toEqual({ baseName: "vacation-photo", extension: "jpg" });
  });
  it("only treats the last dot as the extension", () => {
    expect(splitFilename("my.holiday.photo.png")).toEqual({ baseName: "my.holiday.photo", extension: "png" });
  });
  it("handles names without an extension and dotfiles", () => {
    expect(splitFilename("README")).toEqual({ baseName: "README", extension: "" });
    expect(splitFilename(".hidden")).toEqual({ baseName: ".hidden", extension: "" });
  });
});

describe("formatFilename", () => {
  it("keeps the original name and swaps the extension by default", () => {
    expect(formatFilename({ pattern: "{name}" }, context)).toBe("vacation-photo.webp");
  });

  it("uses .jpg for JPEG", () => {
    expect(formatFilename({ pattern: "{name}" }, { ...context, format: "jpeg" })).toBe("vacation-photo.jpg");
  });

  it("supports dimension tokens", () => {
    expect(formatFilename({ pattern: "{name}-{width}x{height}" }, context)).toBe("vacation-photo-1200x800.webp");
  });

  it("supports the format token", () => {
    expect(formatFilename({ pattern: "{name}-{format}" }, context)).toBe("vacation-photo-webp.webp");
  });

  it("zero-pads the index to the batch size", () => {
    expect(formatFilename({ pattern: "wedding-photo-{index}" }, context)).toBe("wedding-photo-03.webp");
    expect(formatFilename({ pattern: "image-{index}" }, { ...context, index: 7, total: 150 })).toBe("image-007.webp");
  });

  it("leaves unknown tokens alone", () => {
    expect(formatFilename({ pattern: "{name}-{nope}" }, context)).toBe("vacation-photo-{nope}.webp");
  });

  it("applies lowercase and space replacement", () => {
    const spaced = { ...context, name: "My Summer Trip" };
    expect(formatFilename({ pattern: "{name}", lowercase: true, replaceSpaces: true, separator: "_" }, spaced)).toBe(
      "my_summer_trip.webp",
    );
    expect(formatFilename({ pattern: "{name}" }, spaced)).toBe("My Summer Trip.webp");
  });

  it("strips path separators and other unsafe characters", () => {
    expect(formatFilename({ pattern: "../../{name}" }, { ...context, name: "a/b\\c:d" })).toBe("abcd.webp");
  });

  it("falls back when the pattern produces nothing", () => {
    expect(formatFilename({ pattern: "   " }, context)).toBe("vacation-photo.webp");
    expect(formatFilename({ pattern: "///" }, context)).toBe("image.webp");
  });
});

describe("padIndex", () => {
  it("uses at least two digits", () => {
    expect(padIndex(1, 3)).toBe("01");
    expect(padIndex(10, 99)).toBe("10");
    expect(padIndex(5, 1000)).toBe("0005");
  });
});

describe("sanitizeFilenamePart", () => {
  it("removes leading dots so names cannot become hidden files or parent paths", () => {
    expect(sanitizeFilenamePart("..secret")).toBe("secret");
  });
  it("removes control characters", () => {
    expect(sanitizeFilenamePart("a\u0000b\u001fc")).toBe("abc");
  });
});

describe("dedupeFilenames", () => {
  it("leaves unique names untouched", () => {
    expect(dedupeFilenames(["a.jpg", "b.jpg"])).toEqual(["a.jpg", "b.jpg"]);
  });

  it("appends a counter to collisions", () => {
    expect(dedupeFilenames(["photo.jpg", "photo.jpg", "photo.jpg"])).toEqual(["photo.jpg", "photo-2.jpg", "photo-3.jpg"]);
  });

  it("is case-insensitive", () => {
    expect(dedupeFilenames(["Photo.jpg", "photo.jpg"])).toEqual(["Photo.jpg", "photo-2.jpg"]);
  });

  it("does not collide with a name that already uses the suffix", () => {
    expect(dedupeFilenames(["photo.jpg", "photo-2.jpg", "photo.jpg"])).toEqual(["photo.jpg", "photo-2.jpg", "photo-3.jpg"]);
  });

  it("dedupes within folders independently", () => {
    expect(dedupeFilenames(["full/a.webp", "thumb/a.webp", "thumb/a.webp"])).toEqual([
      "full/a.webp",
      "thumb/a.webp",
      "thumb/a-2.webp",
    ]);
  });
});

describe("toFolderName", () => {
  it("makes a variant name folder-safe", () => {
    expect(toFolderName("Full Size / HD")).toBe("full-size-hd");
    expect(toFolderName("///")).toBe("output");
  });
});
