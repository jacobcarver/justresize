/**
 * The example photographs used in the homepage's figures: four real pictures
 * (public/samples, credited in credits.txt there), in the order the figures
 * list them as files. Plain data, so server and client components can share it.
 */
export interface SamplePhoto {
  /** The file name the figures show for it. */
  name: string;
  /** 960 × 720, for the workspace figure. */
  src: string;
  /** 96 × 96, for a row in the file list. */
  thumb: string;
}

export const SAMPLE_PHOTOS: SamplePhoto[] = [
  { name: "IMG_2041.jpg", src: "/samples/mountains.webp", thumb: "/samples/mountains-thumb.webp" },
  { name: "IMG_2042.jpg", src: "/samples/water.webp", thumb: "/samples/water-thumb.webp" },
  { name: "IMG_2043.jpg", src: "/samples/dune.webp", thumb: "/samples/dune-thumb.webp" },
  { name: "IMG_2044.jpg", src: "/samples/blossom.webp", thumb: "/samples/blossom-thumb.webp" },
];
