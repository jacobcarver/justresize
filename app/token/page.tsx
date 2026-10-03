import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { siteContainer, SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { TrackView } from "@/components/site/TrackView";
import { TokenPage } from "@/components/token/TokenPage";
import { pageMetadata, TOKEN_OG_IMAGE } from "@/lib/seo";
import { getToken } from "@/lib/token";
import { getTokenActivity } from "@/lib/token-activity";

export const metadata: Metadata = pageMetadata({
  title: "JustResize on Solana — Official token information",
  description:
    "The official source for the JustResize project token: its status, network and mint address. Verify every address here.",
  path: "/token",
  image: TOKEN_OG_IMAGE,
});

export default async function TokenRoute() {
  const token = getToken();
  // Switched off in lib/config/site.ts: the page does not exist.
  if (!token.enabled) notFound();
  // Null before launch, and whenever the data source cannot be reached: the page is complete without it.
  const activity = await getTokenActivity(token);

  return (
    <>
      <SiteHeader current="/token" />
      <main className={siteContainer}>
        <TokenPage token={token} activity={activity} />
      </main>
      <SiteFooter />
      <TrackView event={{ name: "token_page_viewed" }} />
    </>
  );
}
