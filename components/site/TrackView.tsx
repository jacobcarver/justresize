"use client";

import { useEffect } from "react";
import { type AnalyticsEvent, track } from "@/lib/analytics";

/** Reports one page view to the analytics seam, which does nothing unless a provider has been plugged in. */
export function TrackView({ event }: { event: Extract<AnalyticsEvent, { name: "token_page_viewed" }> }) {
  useEffect(() => {
    track(event);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per page view, whatever object the parent passes.
  }, []);
  return null;
}
