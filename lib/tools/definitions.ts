/**
 * Tool pages as data. Each entry becomes a real route (/compress-image,
 * /convert-to-webp, …) that opens the same app preconfigured for that job,
 * with a short page of its own underneath.
 *
 * Add an entry only when it changes what the tool does on arrival — a page
 * that differs from another in name alone is not worth having.
 */
import { KB, MB } from "@/lib/utils/bytes";
import type { TransformConfig } from "@/types";

export interface ToolDefinition {
  /** URL path segment. */
  slug: string;
  /** The <title>, used as written. */
  title: string;
  /** The page's h1, shown in the app bar after the wordmark. */
  heading: string;
  /** Short name for footers and link lists. */
  navLabel: string;
  /** One line under the app bar and in search results. */
  description: string;
  /** Settings applied when the page opens. */
  initialConfig?: Partial<TransformConfig>;
  /** Says what the page has set up, shown with the empty workspace (the settings themselves appear once images are open). */
  presetNote?: string;
  /** The page under the tool. Short and specific to this job. */
  sections?: { heading: string; body: string[] }[];
  faq?: { question: string; answer: string }[];
}

/** The plain workspace at /app: no preset, no page underneath. */
export const APP_TOOL: ToolDefinition = {
  slug: "app",
  title: "JustResize App — Image Resizer, Compressor and Converter",
  heading: "Resize images",
  navLabel: "Open tool",
  description: "Resize images without uploading them.",
};

export const TOOLS: ToolDefinition[] = [
  {
    slug: "resize-image",
    title: "Resize Images Online — Private, Local & Fast | JustResize",
    heading: "Resize images",
    navLabel: "Resize images",
    description: "Set a width, a height or both. Your images stay on your device.",
    initialConfig: { resizeMode: "dimensions" },
    sections: [
      {
        heading: "Resize to exact pixel dimensions",
        body: [
          "Type a width and the height follows, or unlock the ratio and set both. When the new shape doesn't match the original, choose whether the image is cropped to fill it, padded to fit inside it, or stretched. With Fill, drag the preview to pick the part that stays.",
          "The preview and the export are computed by the same code, so the size you see is the size you get.",
        ],
      },
      {
        heading: "Sharp results",
        body: [
          "Shrinking uses a Lanczos filter and a light sharpening pass rather than the softer scaling browsers apply by default, so text in screenshots stays readable.",
          "Every run starts again from your original file, so resizing twice never stacks quality loss.",
        ],
      },
    ],
    faq: [
      {
        question: "Are my images uploaded anywhere?",
        answer:
          "No. JustResize has no server that receives images. Your browser reads the file, resizes it on your device and saves the result as a new file.",
      },
      {
        question: "Which formats can I resize?",
        answer:
          "JPEG, PNG and WebP everywhere, AVIF where your browser can read it, and still GIFs. HEIC photos work in Safari. You can save as JPEG, PNG, WebP or AVIF.",
      },
      {
        question: "Can I make an image larger?",
        answer:
          "Yes, up to 100 megapixels. Enlarging can't add detail that isn't in the original, so large increases will look soft.",
      },
      {
        question: "Is there a limit on file size or count?",
        answer:
          "Not on file size, and not on how many images you add. A single image can be up to 120 megapixels, and very large batches are limited only by your device's memory.",
      },
    ],
  },
  {
    slug: "compress-image",
    title: "Compress Images Without Uploading Them | JustResize",
    heading: "Compress images",
    navLabel: "Compress images",
    description: "Make image files smaller without changing their dimensions.",
    initialConfig: { resizeMode: "target-filesize", targetFileSize: { bytes: 1 * MB, strategy: "quality-only" } },
    presetNote: "Set up to compress under 1 MB, keeping dimensions.",
    sections: [
      {
        heading: "Smaller files, same dimensions",
        body: [
          "This page opens set to Compress only: every image keeps its width and height, and quality is lowered just far enough to get under the size you choose. Change the number to whatever you need.",
          "For JPEG, WebP and AVIF that means searching for the highest quality setting that fits. PNG has no quality setting, so colours are reduced instead, which keeps edges and text sharp.",
        ],
      },
      {
        heading: "When compression alone isn't enough",
        body: [
          "A 12-megapixel photo can only get so small before it falls apart. If a file can't reach your size at an acceptable quality, JustResize says so rather than handing you a ruined image. Switch the strategy to Smart and it will reduce dimensions as a last step.",
        ],
      },
    ],
    faq: [
      {
        question: "How much smaller will my image get?",
        answer:
          "It depends on the image and the format. Re-saving a phone photo as WebP at quality 80 often cuts the file size by more than half. The result line shows the exact size and the percentage saved for every file.",
      },
      {
        question: "Does compressing remove metadata?",
        answer:
          "Yes. Output files are written from pixels alone, so EXIF data, including GPS location, is not carried over.",
      },
      {
        question: "Which format compresses best?",
        answer:
          "AVIF usually gives the smallest files and is the slowest to create. WebP is close behind and fast. JPEG is the most widely accepted. PNG is best for screenshots and graphics with transparency.",
      },
    ],
  },
  {
    slug: "reduce-image-file-size",
    title: "Reduce Image File Size to an Exact Limit (500 KB, 1 MB…) | JustResize",
    heading: "Reduce image file size",
    navLabel: "Target file size",
    description: "Name a limit, like 500 KB. Get the best quality that fits under it.",
    initialConfig: { resizeMode: "target-filesize", targetFileSize: { bytes: 500 * KB, strategy: "smart" } },
    presetNote: "Set up to bring each image under 500 KB.",
    sections: [
      {
        heading: "For upload forms with a size limit",
        body: [
          "Job applications, visa portals, marketplaces and forums all reject files over some limit. Enter that limit here and each image comes out at or under it. Never over, never \"close\".",
          "The page opens at 500 KB. Any size from a few kilobytes up works, in KB or MB.",
        ],
      },
      {
        heading: "How the size is reached",
        body: [
          "JustResize encodes the image several times, searching for the highest quality that fits. With the Smart strategy, dimensions are reduced only if quality alone can't get there. Compress only never changes dimensions. Resize only keeps your quality setting and shrinks the image instead.",
          "If the result needed smaller dimensions or fewer colours, the result line tells you exactly what changed.",
        ],
      },
    ],
    faq: [
      {
        question: "Is the result guaranteed to be under the limit?",
        answer:
          "Yes. Each output is checked against the limit before it is marked ready. If the limit can't be reached, the image fails with an explanation instead of silently coming out too large.",
      },
      {
        question: "Does 500 KB mean 500,000 bytes?",
        answer:
          "JustResize uses 1 KB = 1,024 bytes, so 500 KB is 512,000 bytes. A site that enforces a strict decimal limit of 500,000 bytes needs a slightly lower target, for example 480 KB.",
      },
      {
        question: "Can I do this for many images at once?",
        answer: "Yes. The limit applies to every image you add, and the results download as one ZIP.",
      },
    ],
  },
  {
    slug: "convert-to-webp",
    title: "Convert Images to WebP — In Your Browser, No Upload | JustResize",
    heading: "Convert to WebP",
    navLabel: "Convert to WebP",
    description: "Turn JPEG and PNG images into smaller WebP files, with transparency preserved.",
    initialConfig: { outputFormat: "webp" },
    presetNote: "Set up to save as WebP.",
    sections: [
      {
        heading: "Why WebP",
        body: [
          "WebP files are usually much smaller than the same image as JPEG or PNG, and every current browser displays them. Unlike JPEG, WebP keeps transparency, so it can replace PNG for logos and cut-outs as well.",
        ],
      },
      {
        heading: "Convert, and resize while you're at it",
        body: [
          "Dimensions stay as they are unless you change them. Set a width or a maximum size to resize in the same pass, and adjust quality with the slider: 80 to 85 is a good range for photos.",
          "Some browsers, Safari among them, can't create WebP on their own. There JustResize loads a WebP encoder that runs on your device, and the result is the same.",
        ],
      },
    ],
    faq: [
      {
        question: "Will converting to WebP lose quality?",
        answer:
          "WebP output here is lossy, like JPEG, with a quality setting you control. At 80 or above the difference from the original is hard to see for most photos.",
      },
      {
        question: "Is transparency kept?",
        answer: "Yes. Transparent PNGs stay transparent as WebP.",
      },
      {
        question: "Can I convert WebP back to JPEG or PNG?",
        answer: "Yes. Add the WebP files and pick JPEG or PNG under Output.",
      },
    ],
  },
  {
    slug: "convert-to-jpg",
    title: "Convert Images to JPG — PNG, WebP and AVIF to JPEG, No Upload | JustResize",
    heading: "Convert to JPG",
    navLabel: "Convert to JPG",
    description: "Turn PNG, WebP and AVIF images into JPEG files that open everywhere.",
    initialConfig: { outputFormat: "jpeg" },
    presetNote: "Set up to save as JPEG.",
    sections: [
      {
        heading: "The format everything accepts",
        body: [
          "JPEG is the one image format every app, upload form and old device can open. This page opens set to save as JPEG, whatever you add: PNG, WebP, AVIF, a still GIF, or a HEIC photo in Safari.",
          "Dimensions stay as they are unless you change them. The quality slider controls how hard the file is compressed, and the result line shows the size you got.",
        ],
      },
      {
        heading: "What happens to transparency",
        body: [
          "JPEG has no transparency. Transparent areas are filled with a background colour: white unless you pick black or a colour of your own under Output.",
        ],
      },
    ],
    faq: [
      {
        question: "Is JPG the same as JPEG?",
        answer: "Yes. They are two spellings of one format. Files are saved with the .jpg extension.",
      },
      {
        question: "Can I convert iPhone HEIC photos to JPG?",
        answer:
          "In Safari, yes: it can read HEIC, so the photos open here and save as JPEG. Other browsers can't decode HEIC, and JustResize says so rather than failing silently.",
      },
      {
        question: "Will converting to JPG reduce quality?",
        answer:
          "JPEG is lossy, so some detail is traded for a smaller file. At the default quality the difference is hard to see in photos. Screenshots and graphics with sharp edges usually look better as PNG.",
      },
    ],
  },
  {
    slug: "convert-to-png",
    title: "Convert Images to PNG — Lossless, With Transparency | JustResize",
    heading: "Convert to PNG",
    navLabel: "Convert to PNG",
    description: "Save JPEG, WebP and AVIF images as lossless PNG files, with transparency kept.",
    initialConfig: { outputFormat: "png" },
    presetNote: "Set up to save as PNG.",
    sections: [
      {
        heading: "Lossless, pixel for pixel",
        body: [
          "PNG stores every pixel exactly, which is why it suits screenshots, logos, diagrams and anything with text or flat colour. This page opens set to save as PNG, and transparent areas stay transparent.",
          "Because nothing is thrown away there is no quality slider, and a photo saved as PNG is usually larger than the JPEG it came from.",
        ],
      },
      {
        heading: "When the PNG has to be smaller",
        body: [
          "Switch the resize mode to File size and name a limit. If the lossless file is over it, JustResize reduces the number of colours instead of blurring the image, so edges and text stay sharp, and the result line says how many colours were kept.",
        ],
      },
    ],
    faq: [
      {
        question: "Does converting a JPEG to PNG improve its quality?",
        answer:
          "No. PNG keeps exactly the pixels it is given, so compression marks already in the JPEG stay. It does stop any further loss when the file is saved again.",
      },
      {
        question: "Is transparency kept?",
        answer: "Yes. Transparent WebP and AVIF images stay transparent as PNG.",
      },
      {
        question: "Why is my PNG bigger than the original?",
        answer:
          "PNG is lossless, and photos compress poorly without loss. For photos WebP or JPEG give much smaller files; PNG is the right choice for screenshots and graphics.",
      },
    ],
  },
  {
    slug: "convert-to-avif",
    title: "Convert Images to AVIF — Smaller Than WebP, In Your Browser | JustResize",
    heading: "Convert to AVIF",
    navLabel: "Convert to AVIF",
    description: "Save JPEG, PNG and WebP images as AVIF, usually the smallest file of all.",
    initialConfig: { outputFormat: "avif" },
    presetNote: "Set up to save as AVIF.",
    sections: [
      {
        heading: "The smallest files",
        body: [
          "AVIF usually produces the smallest file at a given quality, smaller than WebP and much smaller than JPEG, and it keeps transparency. Current versions of Chrome, Safari, Firefox and Edge all display it.",
        ],
      },
      {
        heading: "Encoded on your device",
        body: [
          "Browsers can show AVIF but can't create it, so JustResize downloads an AVIF encoder the first time you use it and runs it on your device. Your images are still not uploaded.",
          "AVIF takes longer to create than the other formats, most noticeably with large photos. Batches run several images at a time in the background.",
        ],
      },
    ],
    faq: [
      {
        question: "Is AVIF better than WebP?",
        answer:
          "For file size, usually: AVIF files are typically smaller at the same visual quality. WebP is faster to create and has been supported for longer. Both keep transparency.",
      },
      {
        question: "Why is converting to AVIF slower?",
        answer:
          "AVIF does more work to find a smaller file, and here it runs in an encoder on your own device rather than one built into the browser.",
      },
      {
        question: "Where can AVIF files be used?",
        answer:
          "On the web, in every current major browser. Some older apps and upload forms don't accept AVIF yet; for those, JPEG is the safe choice.",
      },
    ],
  },
  {
    slug: "bulk-image-resizer",
    title: "Bulk Image Resizer — Resize Hundreds of Images at Once | JustResize",
    heading: "Resize images in bulk",
    navLabel: "Bulk resize",
    description: "Drop a whole folder of photos, fit them all within one size, and download a ZIP.",
    initialConfig: { resizeMode: "max-dimensions", width: 1920, height: 1920 },
    presetNote: "Set up to fit every image within 1920 px.",
    sections: [
      {
        heading: "One setting, every image",
        body: [
          "This page opens in Max size mode at 1920 px: each image keeps its shape and is scaled down until it fits. Portrait, landscape and square images are all handled correctly, and anything already smaller is left as it is.",
          "Drop files or a whole folder. There is no cap on how many images you add.",
        ],
      },
      {
        heading: "Built for batches",
        body: [
          "Images are processed several at a time on your device's processor cores, and the page stays responsive while they run. One bad file never stops the rest: it is reported on its own row and the batch carries on.",
          "When the batch finishes, Download ZIP saves everything in one archive. File names follow the pattern you choose, and duplicates are numbered rather than overwritten.",
        ],
      },
    ],
    faq: [
      {
        question: "How many images can I resize at once?",
        answer: "As many as you like: there is no cap. Very large batches are limited by your device's memory, since the ZIP is assembled locally.",
      },
      {
        question: "Can each image have different settings?",
        answer:
          "Size, format and quality apply to the whole batch. Crop position can be set per image, and several output sizes per image can be set up under Advanced.",
      },
      {
        question: "Does it work with folders?",
        answer: "Yes. Drop a folder onto the page and the images inside it, including subfolders, are added.",
      },
    ],
  },
];

export function findTool(slug: string): ToolDefinition | undefined {
  return TOOLS.find((tool) => tool.slug === slug);
}
