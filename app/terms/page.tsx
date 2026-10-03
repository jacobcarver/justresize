import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage } from "@/components/site/Prose";
import { SITE, TOKEN_CONFIG } from "@/lib/config/site";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Terms — JustResize",
  description: "The terms for using JustResize: a free image tool provided as is, with a plain disclosure about the project token.",
  path: "/terms",
});

export default function TermsPage() {
  const operator = SITE.legal.operator || "the JustResize project";

  return (
    <ProsePage
      current="/terms"
      title="Terms"
      lead="Plain terms for a simple tool. By using JustResize you agree to them."
      updated={SITE.legal.lastUpdated}
    >
      <h2>The service</h2>
      <p>
        JustResize is a free tool for resizing, cropping, compressing and converting images in your browser, provided by {operator}.
        There is no account and no charge.
      </p>

      <h2>Your files</h2>
      <p>
        Your images stay yours. They are processed on your device and are never sent to us, so we take no rights in them and hold no
        copy. You are responsible for having the right to process the files you use here, and for what you do with the results.
      </p>

      <h2>Provided as is</h2>
      <p>
        JustResize is provided as is and as available, without warranties of any kind. We don&apos;t promise that results will be
        free of errors or suited to a particular purpose. Check your results before you rely on them, and keep your originals: the
        tool never changes them, but it is also not a backup.
      </p>

      <h2>Availability</h2>
      <p>
        The site may change, be interrupted or be withdrawn at any time, and features may be added or removed, without notice.
      </p>

      <h2>Limits of local processing</h2>
      <p>
        Because the work is done by your browser, what is possible depends on your device. Very large images or batches may be slow
        or may fail on devices with little memory. There is no limit on file size or on the number of images; a single image can be
        up to 120 megapixels. This may change.
      </p>

      <h2>Browser support</h2>
      <p>
        JustResize is built for current versions of Chrome, Edge, Firefox and Safari. Some formats depend on the browser: HEIC photos,
        for example, can only be read where the browser itself can decode them.
      </p>

      <h2>Downloads</h2>
      <p>
        Result files are created on your device and saved through your browser&apos;s normal download. Where they are saved, and
        whether they overwrite other files, is controlled by your browser and operating system.
      </p>

      <h2>Fair use</h2>
      <p>
        Don&apos;t interfere with the site, try to break its security, or present yourself or anything you make as being JustResize or
        endorsed by it.
      </p>

      {TOKEN_CONFIG.enabled && (
        <>
          <h2 id="token">The project token</h2>
          <p>
            The <Link href="/token">token page</Link> gives information about a cryptoasset associated with the JustResize project.
            These terms apply to that information as follows.
          </p>
          <ul>
            <li>
              <strong>Information only.</strong> Nothing on this site is an offer to sell, a solicitation to buy, or a recommendation
              to hold any token or other asset.
            </li>
            <li>
              <strong>No financial advice.</strong> Nothing here is financial, investment, legal or tax advice. Decide for yourself,
              and take independent advice if you need it.
            </li>
            <li>
              <strong>Risk.</strong> Cryptoassets are volatile and can lose all of their value. Blockchain transactions cannot be
              reversed. Only use funds you can afford to lose.
            </li>
            <li>
              <strong>No rights.</strong> The token does not represent ownership of JustResize, a share of revenue or profit, a debt,
              or a right to any product or feature.
            </li>
            <li>
              <strong>No guarantees.</strong> We do not guarantee the token&apos;s price, liquidity, availability on any exchange, or
              future functionality. Statements about plans are not promises.
            </li>
            <li>
              <strong>Verify addresses.</strong> The only official addresses are those published on the token page of this site. You
              are responsible for checking any address before you use it.
            </li>
            <li>
              <strong>Third parties.</strong> Blockchain explorers, wallets, exchanges and other services linked from or used with the
              token are not controlled by JustResize, and we are not responsible for them.
            </li>
            <li>
              <strong>Your jurisdiction.</strong> Cryptoassets are restricted or regulated in some places. You are responsible for
              complying with the laws that apply to you.
            </li>
          </ul>
          <p>The image tool does not require the token, a wallet or any payment, and these terms give the token no role in it.</p>
        </>
      )}

      <h2>Liability</h2>
      <p>
        To the fullest extent the law allows, {operator} is not liable for any loss arising from use of the site, including loss of
        data, images or cryptoassets, or for indirect or consequential loss. Nothing in these terms limits liability that cannot
        legally be limited.
      </p>

      <h2>Changes</h2>
      <p>
        These terms may be updated. The date at the top shows when they last changed, and continuing to use the site means you accept
        the current version.
      </p>

      {SITE.legal.jurisdiction && (
        <>
          <h2>Governing law</h2>
          <p>These terms are governed by the laws of {SITE.legal.jurisdiction}.</p>
        </>
      )}

      {SITE.contactEmail && (
        <>
          <h2>Contact</h2>
          <p>
            Questions about these terms: <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>.
          </p>
        </>
      )}
    </ProsePage>
  );
}
