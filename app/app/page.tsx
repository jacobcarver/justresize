import type { Metadata } from "next";
import { ToolShell } from "@/components/workspace/ToolShell";
import { pageMetadata } from "@/lib/seo";
import { APP_TOOL } from "@/lib/tools/definitions";

export const metadata: Metadata = pageMetadata({
  title: APP_TOOL.title,
  description:
    "The JustResize workspace. Resize, crop, compress and convert images in your browser: batches, exact file-size targets, ZIP download. Nothing is uploaded.",
  path: "/app",
});

export default function AppPage() {
  return <ToolShell tool={APP_TOOL} />;
}
