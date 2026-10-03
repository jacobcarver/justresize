/**
 * Built-in size presets. Pure data: add, remove or reorder entries here and
 * the UI follows. Categories are rendered in the order they first appear.
 */
import type { AspectRatioSetting, ResizePreset } from "@/types";

export const SIZE_PRESETS: ResizePreset[] = [
  { id: "common-1920x1080", category: "Common", label: "Full HD · 1920 × 1080", width: 1920, height: 1080 },
  { id: "common-1280x720", category: "Common", label: "HD · 1280 × 720", width: 1280, height: 720 },
  { id: "common-1080x1080", category: "Common", label: "Square · 1080 × 1080", width: 1080, height: 1080 },
  { id: "common-1080x1350", category: "Common", label: "Portrait · 1080 × 1350", width: 1080, height: 1350 },
  { id: "common-1080x1920", category: "Common", label: "Story · 1080 × 1920", width: 1080, height: 1920 },
  { id: "common-1200x630", category: "Common", label: "OG image · 1200 × 630", width: 1200, height: 630 },

  { id: "social-square", category: "Social", label: "Square post · 1080 × 1080", width: 1080, height: 1080 },
  { id: "social-portrait", category: "Social", label: "Portrait post · 1080 × 1350", width: 1080, height: 1350 },
  { id: "social-story", category: "Social", label: "Story / Reel · 1080 × 1920", width: 1080, height: 1920 },
  { id: "social-link", category: "Social", label: "Link preview · 1200 × 630", width: 1200, height: 630 },
  { id: "social-header", category: "Social", label: "Profile header · 1500 × 500", width: 1500, height: 500 },
  { id: "social-avatar", category: "Social", label: "Profile picture · 400 × 400", width: 400, height: 400 },

  { id: "video-4k", category: "Video", label: "4K UHD · 3840 × 2160", width: 3840, height: 2160 },
  { id: "video-1080p", category: "Video", label: "1080p · 1920 × 1080", width: 1920, height: 1080 },
  { id: "video-720p", category: "Video", label: "720p · 1280 × 720", width: 1280, height: 720 },
  { id: "video-thumbnail", category: "Video", label: "Video thumbnail · 1280 × 720", width: 1280, height: 720 },

  { id: "web-hero", category: "Web", label: "Hero · 1920 × 1080", width: 1920, height: 1080 },
  { id: "web-content", category: "Web", label: "Content image · 1200 × 800", width: 1200, height: 800 },
  { id: "web-thumbnail", category: "Web", label: "Thumbnail · 400 × 400", width: 400, height: 400 },
  { id: "web-favicon", category: "Web", label: "App icon · 512 × 512", width: 512, height: 512, format: "png" },

  { id: "print-4x6", category: "Print", label: "4 × 6 in at 300 dpi · 1800 × 1200", width: 1800, height: 1200 },
  { id: "print-5x7", category: "Print", label: "5 × 7 in at 300 dpi · 2100 × 1500", width: 2100, height: 1500 },
  { id: "print-8x10", category: "Print", label: "8 × 10 in at 300 dpi · 3000 × 2400", width: 3000, height: 2400 },
  { id: "print-a4", category: "Print", label: "A4 at 300 dpi · 2480 × 3508", width: 2480, height: 3508 },

  { id: "device-phone", category: "Device", label: "Phone wallpaper · 1170 × 2532", width: 1170, height: 2532 },
  { id: "device-tablet", category: "Device", label: "Tablet wallpaper · 2048 × 2732", width: 2048, height: 2732 },
  { id: "device-desktop", category: "Device", label: "Desktop wallpaper · 2560 × 1440", width: 2560, height: 1440 },
];

export function presetCategories(presets: ResizePreset[] = SIZE_PRESETS): string[] {
  return [...new Set(presets.map((preset) => preset.category))];
}

export interface AspectRatioPreset {
  id: string;
  label: string;
  /** Undefined = each image's original ratio. */
  ratio?: AspectRatioSetting;
}

export const ASPECT_RATIO_PRESETS: AspectRatioPreset[] = [
  { id: "original", label: "Original" },
  { id: "1:1", label: "1:1", ratio: { w: 1, h: 1 } },
  { id: "4:3", label: "4:3", ratio: { w: 4, h: 3 } },
  { id: "3:2", label: "3:2", ratio: { w: 3, h: 2 } },
  { id: "16:9", label: "16:9", ratio: { w: 16, h: 9 } },
  { id: "9:16", label: "9:16", ratio: { w: 9, h: 16 } },
  { id: "4:5", label: "4:5", ratio: { w: 4, h: 5 } },
  { id: "5:4", label: "5:4", ratio: { w: 5, h: 4 } },
  { id: "21:9", label: "21:9", ratio: { w: 21, h: 9 } },
];

export const PERCENTAGE_PRESETS = [25, 50, 75, 150, 200];
