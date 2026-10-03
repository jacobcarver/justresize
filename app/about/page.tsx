import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage } from "@/components/site/Prose";
import { buttonClass } from "@/components/ui/Button";
import { pageMetadata } from "@/lib/seo";
import { getToken } from "@/lib/token";

export const metadata: Metadata = pageMetadata({
  title: "About JustResize — Why it exists and how it works",
  description:
    "JustResize is an image resizer that runs entirely in your browser: no uploads, no account, no clutter. Why it was built and what it is made of.",
  path: "/about",
});

export default function AboutPage() {
  const token = getToken();

  return (
    <ProsePage
      current="/about"
      title="About JustResize"
      lead="A small tool with one job: take an image you have and make it the size you need."
    >
      <h2>Why it exists</h2>
      <p>
        Most online image tools work the same way. You upload your pictures to someone else&apos;s server, wait for them to come back,
        and then find the download. Some want an account before they will hand over your own file.
      </p>
      <p>
        None of that is needed. A current browser can read an image, resize it and write a new file by itself, and it can do it
        faster than an upload takes. JustResize is built on that: the work happens on your device, there is nothing to sign up for,
        and the page shows the tool and not much else.
      </p>

      <h2>What it doesn&apos;t do</h2>
      <ul>
        <li>It doesn&apos;t keep metadata. Output files are written from pixels, so EXIF data such as location is left out.</li>
        <li>It doesn&apos;t handle animation. Animated GIF and WebP files are turned away rather than flattened to one frame.</li>
        <li>It reads HEIC photos only in browsers that can decode them, which today means Safari.</li>
        <li>It doesn&apos;t edit. No filters, no text, no layers: just size, crop, format and compression.</li>
      </ul>

      {token.enabled && (
        <>
          <h2>The project</h2>
          <p>
            {token.live ? "JustResize also has a project token on Solana" : "A JustResize project token on Solana is planned"}, kept
            deliberately apart from the tool: resizing needs no wallet and no token. What is official about it is published on the{" "}
            <Link href="/token">token page</Link>.
          </p>
        </>
      )}

      <p className="pt-6">
        <Link href="/app" className={buttonClass("primary", "lg")}>
          Open JustResize
        </Link>
      </p>
    </ProsePage>
  );
}
