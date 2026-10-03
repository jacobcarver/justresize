/**
 * Engine clients: the two ways a request can be executed.
 */
import { CONCURRENCY } from "@/lib/config/limits";
import { runEngineRequest } from "@/lib/image/engine";
import { cancelledError, ImageError } from "@/lib/image/errors";
import type { EngineClient } from "./pool";
import type { EngineHooks, EngineRequest, EngineResult, FromWorkerMessage, ToWorkerMessage } from "./protocol";

interface ActiveRun {
  id: number;
  hooks: EngineHooks;
  resolve: (result: EngineResult) => void;
  reject: (error: unknown) => void;
  onAbort: () => void;
  cancelTimer?: ReturnType<typeof setTimeout>;
}

/** Runs requests in a dedicated Web Worker, one at a time. */
export class WorkerEngineClient implements EngineClient {
  private worker: Worker | null = null;
  private active: ActiveRun | null = null;
  private sequence = 0;

  constructor(
    readonly label: string,
    private readonly createWorker: () => Worker,
  ) {}

  run(request: EngineRequest, hooks: EngineHooks): Promise<EngineResult> {
    return new Promise<EngineResult>((resolve, reject) => {
      if (hooks.signal?.aborted) {
        reject(cancelledError());
        return;
      }
      const id = ++this.sequence;
      const run: ActiveRun = {
        id,
        hooks,
        resolve,
        reject,
        onAbort: () => this.cancel(run),
      };
      this.active = run;
      hooks.signal?.addEventListener("abort", run.onAbort, { once: true });

      try {
        this.post({ kind: "run", id, request });
      } catch (error) {
        this.settle(run);
        reject(error);
      }
    });
  }

  dispose(): void {
    const run = this.active;
    if (run) {
      this.settle(run);
      run.reject(cancelledError());
    }
    this.worker?.terminate();
    this.worker = null;
  }

  private post(message: ToWorkerMessage): void {
    if (!this.worker) {
      this.worker = this.createWorker();
      this.worker.onmessage = (event: MessageEvent<FromWorkerMessage>) => this.handleMessage(event.data);
      this.worker.onerror = (event) => {
        event.preventDefault?.();
        this.handleCrash(event.message || "Worker error");
      };
      this.worker.onmessageerror = () => this.handleCrash("Worker message could not be deserialized");
    }
    this.worker.postMessage(message);
  }

  private handleMessage(message: FromWorkerMessage): void {
    const run = this.active;
    // Messages from a run that was already cancelled or replaced are stale.
    if (!run || run.id !== message.id) return;

    switch (message.kind) {
      case "stage":
        run.hooks.onStage?.(message.stage);
        break;
      case "done":
        this.settle(run);
        // The worker may finish in the instant a cancel is in flight.
        if (run.hooks.signal?.aborted) run.reject(cancelledError());
        else run.resolve(message.result);
        break;
      case "failed":
        this.settle(run);
        run.reject(new ImageError(message.error.category, message.error.message, message.error.detail));
        break;
    }
  }

  /**
   * Ask the worker to stop. If it has not answered within the grace period
   * it is stuck in a long synchronous step, so terminate it; a fresh worker
   * is created on the next request. Either way its memory is released.
   */
  private cancel(run: ActiveRun): void {
    if (this.active !== run) return;
    try {
      this.worker?.postMessage({ kind: "cancel", id: run.id } satisfies ToWorkerMessage);
    } catch {
      // Worker already gone; the timer below cleans up.
    }
    run.cancelTimer = setTimeout(() => {
      if (this.active !== run) return;
      this.restart();
      this.settle(run);
      run.reject(cancelledError());
    }, CONCURRENCY.cancelGraceMs);
  }

  private handleCrash(detail: string): void {
    const run = this.active;
    this.restart();
    if (!run) return;
    this.settle(run);
    run.reject(
      new ImageError(
        /memory|allocation/i.test(detail) ? "memory_limit" : "unknown",
        "Processing stopped unexpectedly. The image may be too large for this device.",
        detail,
      ),
    );
  }

  private restart(): void {
    this.worker?.terminate();
    this.worker = null;
  }

  private settle(run: ActiveRun): void {
    if (run.cancelTimer) clearTimeout(run.cancelTimer);
    run.hooks.signal?.removeEventListener("abort", run.onAbort);
    if (this.active === run) this.active = null;
  }
}

/**
 * Compatibility mode: runs the engine on the main thread for browsers
 * without module workers or OffscreenCanvas. Slower and can stutter the UI
 * on big images, but the tool still works.
 */
export class MainThreadEngineClient implements EngineClient {
  readonly label = "main";

  run(request: EngineRequest, hooks: EngineHooks): Promise<EngineResult> {
    return runEngineRequest(request, hooks);
  }

  dispose(): void {}
}
