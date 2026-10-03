import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage } from "@/components/site/Prose";
import { adsenseClient } from "@/lib/ads";
import { SITE, TOKEN_CONFIG } from "@/lib/config/site";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Privacy — JustResize",
  description:
    "Your images are processed in your browser and never uploaded. What JustResize stores on your device, how advertising on the site works, and what the web host logs.",
  path: "/privacy",
});

export default function PrivacyPage() {
  // Whether the site is set up to carry Google's ads. The two versions of this page must each be true as written.
  const ads = adsenseClient() !== null;

  return (
    <ProsePage
      current="/privacy"
      title="Privacy"
      lead="The short version: your images stay on your device. The rest of this page is about the little that isn't images."
      updated={SITE.legal.lastUpdated}
    >
      <h2>Your images</h2>
      <p>
        Images you add to JustResize are opened, resized, compressed and converted by your own browser, on your own device. They are
        not uploaded to JustResize or to anyone else. We never receive the images, their file names, their dimensions or anything
        derived from them, so we have nothing to store, look at or share.
      </p>
      <p>
        The files you download are written from pixels alone. Metadata in the original, such as the camera model or the location a
        photo was taken, is not copied into them.
      </p>

      <h2>What is kept in your browser</h2>
      <p>
        So the tool opens the way you left it, your browser&apos;s local storage holds your resize settings, any presets you saved,
        and a note of whether you dismissed a notice. Images are never stored: reloading the page always starts with an empty list.
      </p>
      <p>
        This information stays in your browser and is not sent to us. Clearing the site&apos;s data in your browser settings removes
        it.
      </p>

      {ads ? (
        <>
          <h2>Advertising and cookies</h2>
          <p>
            JustResize is free and is paid for by advertising. The ads are served by Google AdSense, and Google&apos;s ad script is
            the only code on this site that comes from a third party. JustResize&apos;s own code sets no cookies and runs no analytics.
          </p>
          <p>
            Google and its advertising partners use cookies and similar identifiers, including cookies stored under this site&apos;s
            address, to show ads, to limit how often you see one, and to measure how they perform. Depending on your choices and where you live, the ads may be personalised using information
            about your visits to this and other websites. To do this Google receives your IP address, details of your browser and
            device, and the address of the page you are on. See{" "}
            <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener noreferrer">
              how Google uses information from sites that use its services
            </a>
            .
          </p>
          <p>
            You can turn off personalised ads in{" "}
            <a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer">
              Google&apos;s Ads Settings
            </a>
            , or opt out of personalised advertising from many companies at once at{" "}
            <a href="https://www.aboutads.info/choices" target="_blank" rel="noopener noreferrer">
              aboutads.info
            </a>{" "}
            and{" "}
            <a href="https://www.youronlinechoices.eu" target="_blank" rel="noopener noreferrer">
              youronlinechoices.eu
            </a>
            .
          </p>
          <p>
            Advertising never involves your images. They are not uploaded, so neither JustResize nor Google receives them, their file
            names or anything derived from them.
          </p>
        </>
      ) : (
        <>
          <h2>Cookies and tracking</h2>
          <p>
            JustResize sets no cookies. It does not use analytics, advertising or tracking scripts, and it loads no code or fonts
            from third parties.
          </p>
          <p>
            If usage statistics are ever added, this page will be updated to say so. They would be limited to anonymous counts, such
            as how many images were resized in a batch, and would never include file names, image content or anything that identifies
            you.
          </p>
        </>
      )}

      <h2>What the web host sees</h2>
      <p>
        Visiting any website means your browser asks a server for its pages. JustResize is hosted by Vercel, which handles those
        requests and, like every host, receives your IP address, your browser type and the address of the page requested. Vercel may
        keep this in logs for a limited time to run and secure the service; see{" "}
        <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">
          Vercel&apos;s privacy policy
        </a>
        .
      </p>
      <p>
        These requests are for the site itself: its pages, code and fonts. They never contain your images.{" "}
        {ads
          ? "The site also sends your browser a security policy that limits where the page may connect to: JustResize itself and Google's advertising services, and nowhere else."
          : "The site also sends your browser a security policy that forbids the page from connecting anywhere except JustResize."}
      </p>

      {TOKEN_CONFIG.enabled && (
        <>
          <h2>Blockchain links</h2>
          <p>
            The <Link href="/token">token page</Link> links to public blockchain explorers run by third parties, which have their own
            privacy policies. JustResize never asks you to connect a wallet and does not collect or record wallet addresses.
          </p>
        </>
      )}

      <h2>Changes</h2>
      <p>If what JustResize does with data changes, this page changes first, and the date at the top with it.</p>

      {SITE.contactEmail && (
        <>
          <h2>Contact</h2>
          <p>
            Questions about privacy: <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>.
          </p>
        </>
      )}
    </ProsePage>
  );
}
