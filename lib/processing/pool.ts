/**
 * Schedules engine requests across a small set of engine clients (workers,
 * or a single main-thread client in compatibility mode).
 *
 * - `concurrency` is a weight budget, not a task count: heavy tasks take
 *   more than one slot (see concurrency.ts).
 * - High-priority tasks (ingestion, previews) jump ahead of queued exports so
 *   the UI stays responsive while a big batch runs.
 * - Aborting a queued task removes it; aborting a running one is delegated
 *   to the client.
 */
import { cancelledError } from "@/lib/image/errors";
import type { EngineHooks, EngineRequest, EngineResult, ResultFor } from "./protocol";

export interface EngineClient {
  readonly label: string;
  run(request: EngineRequest, hooks: EngineHooks): Promise<EngineResult>;
  dispose(): void;
}

export interface RunOptions extends EngineHooks {
  weight?: number;
  priority?: "high" | "normal";
  /** Called when the task leaves the queue and starts on a client. */
  onStart?: (clientLabel: string) => void;
}

interface Task {
  request: EngineRequest;
  options: RunOptions;
  weight: number;
  resolve: (result: EngineResult) => void;
  reject: (error: unknown) => void;
  onAbort?: () => void;
}

export class EnginePool {
  private readonly clients: EngineClient[] = [];
  private readonly idle: EngineClient[] = [];
  private readonly pending: Task[] = [];
  private activeWeight = 0;
  private limit: number;

  constructor(
    private readonly createClient: (index: number) => EngineClient,
    concurrency: number,
  ) {
    this.limit = Math.max(1, concurrency);
  }

  get concurrency(): number {
    return this.limit;
  }

  /** Takes effect for tasks that start from now on; running tasks are left alone. */
  setConcurrency(concurrency: number): void {
    this.limit = Math.max(1, concurrency);
    this.pump();
  }

  run<R extends EngineRequest>(request: R, options: RunOptions = {}): Promise<ResultFor<R>> {
    return new Promise<EngineResult>((resolve, reject) => {
      if (options.signal?.aborted) {
        reject(cancelledError());
        return;
      }
      const task: Task = {
        request,
        options,
        weight: Math.max(1, options.weight ?? 1),
        resolve,
        reject,
      };

      // While queued, an abort simply removes the task.
      task.onAbort = () => {
        const index = this.pending.indexOf(task);
        if (index === -1) return;
        this.pending.splice(index, 1);
        reject(cancelledError());
      };
      options.signal?.addEventListener("abort", task.onAbort, { once: true });

      if (options.priority === "high") {
        // After other high-priority tasks, ahead of every normal one.
        const firstNormal = this.pending.findIndex((queued) => queued.options.priority !== "high");
        this.pending.splice(firstNormal === -1 ? this.pending.length : firstNormal, 0, task);
      } else {
        this.pending.push(task);
      }
      this.pump();
    }) as Promise<ResultFor<R>>;
  }

  dispose(): void {
    for (const task of this.pending.splice(0)) task.reject(cancelledError());
    for (const client of this.clients) client.dispose();
    this.clients.length = 0;
    this.idle.length = 0;
  }

  private pump(): void {
    while (this.pending.length > 0) {
      const next = this.pending[0];
      // A task heavier than the whole budget still runs — alone.
      const fits = this.activeWeight === 0 || this.activeWeight + next.weight <= this.limit;
      if (!fits) return;
      this.pending.shift();
      this.start(next);
    }
  }

  private acquireClient(): EngineClient {
    const idle = this.idle.pop();
    if (idle) return idle;
    const client = this.createClient(this.clients.length);
    this.clients.push(client);
    return client;
  }

  private start(task: Task): void {
    if (task.onAbort) task.options.signal?.removeEventListener("abort", task.onAbort);

    const client = this.acquireClient();
    this.activeWeight += task.weight;
    task.options.onStart?.(client.label);

    client
      .run(task.request, { signal: task.options.signal, onStage: task.options.onStage })
      .then(task.resolve, task.reject)
      .finally(() => {
        this.activeWeight -= task.weight;
        this.idle.push(client);
        this.pump();
      });
  }
}
