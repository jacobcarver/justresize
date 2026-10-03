import { adsenseClient } from "@/lib/ads";

export const dynamic = "force-static";

/**
 * /ads.txt: tells ad buyers that Google is authorised to sell this site's ad
 * space. Written from the same publisher ID as the ad script, so the two
 * cannot drift apart; with no ID configured the file does not exist.
 * f08c47fec0942fa0 is Google's own certification ID, the same for every publisher.
 */
export function GET() {
  const client = adsenseClient();
  if (!client) return new Response("Not found\n", { status: 404 });
  return new Response(`google.com, ${client.replace(/^ca-/, "")}, DIRECT, f08c47fec0942fa0\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
