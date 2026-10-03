/**
 * The one engine pool for the page. Created lazily on first use so nothing
 * here runs during server rendering, and workers are only spawned when a
 * task actually needs one.
 */
import { canProcessInWorker, detectCapabilities } from "@/lib/image/capabilities";
import { MainThreadEngineClient, WorkerEngineClient } from "./clients";
import { defaultConcurrency } from "./concurrency";
import { EnginePool } from "./pool";

let pool: EnginePool | undefined;

export function isCompatibilityMode(): boolean {
  return !canProcessInWorker(detectCapabilities());
}

export function getEnginePool(): EnginePool {
  if (pool) return pool;

  if (isCompatibilityMode()) {
    pool = new EnginePool(() => new MainThreadEngineClient(), 1);
  } else {
    pool = new EnginePool(
      (index) =>
        new WorkerEngineClient(
          `#${index + 1}`,
          () => new Worker(new URL("../../workers/image.worker.ts", import.meta.url), { type: "module" }),
        ),
      defaultConcurrency(navigator.hardwareConcurrency),
    );
  }
  return pool;
}
