import type { MetadataRoute } from "next";
import { SITE } from "@/lib/config/site";

/** Lets the tool be added to a home screen or dock. It opens straight into the workspace. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE.name,
    short_name: SITE.name,
    description: SITE.tagline,
    start_url: "/app",
    display: "standalone",
    background_color: "#0e0f11",
    theme_color: "#0e0f11",
    icons: [
      { src: "/brand/justresize-icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/justresize-icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/justresize-icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
