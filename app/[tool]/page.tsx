import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ToolShell } from "@/components/workspace/ToolShell";
import { pageMetadata, toolOgImage } from "@/lib/seo";
import { findTool, TOOLS } from "@/lib/tools/definitions";

// Only the tools defined in lib/tools/definitions.ts exist; anything else is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return TOOLS.map((tool) => ({ tool: tool.slug }));
}

interface ToolPageProps {
  params: Promise<{ tool: string }>;
}

export async function generateMetadata({ params }: ToolPageProps): Promise<Metadata> {
  const tool = findTool((await params).tool);
  if (!tool) return {};
  return pageMetadata({ title: tool.title, description: tool.description, path: `/${tool.slug}`, image: toolOgImage(tool) });
}

export default async function ToolPage({ params }: ToolPageProps) {
  const tool = findTool((await params).tool);
  if (!tool) notFound();
  return <ToolShell tool={tool} />;
}
