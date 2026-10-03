"use client";

import { getEnginePool, isCompatibilityMode } from "@/lib/processing/runtime";
import { formatBytes } from "@/lib/utils/bytes";
import { useAssetStore } from "@/stores/useAssetStore";
import { allJobs, useProcessingStore } from "@/stores/useProcessingStore";

const ms = (value: number | undefined) => (value === undefined ? "—" : `${Math.round(value)}ms`);

/**
 * Development-only timing breakdown per job. Rendered only when DEBUG is on
 * (dev builds, or NEXT_PUBLIC_DEBUG=true); nothing here leaves the page.
 */
export function DebugPanel() {
  const jobs = useProcessingStore((state) => state.jobs);
  const assets = useAssetStore((state) => state.assets);
  const completed = allJobs(jobs).filter((job) => job.state.status === "complete");
  if (completed.length === 0) return null;

  const byId = new Map(assets.map((asset) => [asset.id, asset]));

  return (
    <details className="rounded-panel border border-dashed border-line p-3 text-xs text-fg-secondary">
      <summary className="cursor-pointer font-medium">
        Debug · {completed.length} jobs · {isCompatibilityMode() ? "main thread" : `${getEnginePool().concurrency} workers`}
      </summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full whitespace-nowrap text-left font-mono tabular-nums">
          <thead className="text-fg-tertiary">
            <tr>
              {["Input", "Output", "Queue", "Decode", "Resize", "Encode", "Total", "Worker"].map((heading) => (
                <th key={heading} className="pr-4 font-normal">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {completed.map((job) => {
              if (job.state.status !== "complete") return null;
              const { result } = job.state;
              const asset = byId.get(job.sourceId);
              return (
                <tr key={job.id}>
                  <td className="pr-4">
                    {asset ? `${asset.width}×${asset.height} ${asset.format ?? "?"} ${formatBytes(asset.fileSize)}` : "—"}
                  </td>
                  <td className="pr-4">
                    {result.width}×{result.height} {result.format} {formatBytes(result.fileSize)}
                    {result.qualityUsed !== undefined ? ` q${Math.round(result.qualityUsed * 100)}` : ""}
                    {result.reducedColors !== undefined ? ` ${result.reducedColors} colours` : ""}
                  </td>
                  <td className="pr-4">{ms(result.timings.queueMs)}</td>
                  <td className="pr-4">{ms(result.timings.decodeMs)}</td>
                  <td className="pr-4">{ms(result.timings.resizeMs)}</td>
                  <td className="pr-4">
                    {ms(result.timings.encodeMs)} ×{result.timings.encodeCount}
                  </td>
                  <td className="pr-4">{ms(result.timings.totalMs)}</td>
                  <td className="pr-4">{result.timings.worker ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </details>
  );
}
