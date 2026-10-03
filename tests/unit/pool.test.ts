import { describe, expect, it } from "vitest";
import { ImageError } from "@/lib/image/errors";
import { defaultConcurrency, reducedConcurrency, taskWeight } from "@/lib/processing/concurrency";
import { type EngineClient, EnginePool } from "@/lib/processing/pool";
import type { EngineHooks, EngineRequest, EngineResult } from "@/lib/processing/protocol";

interface Deferred {
  request: EngineRequest;
  hooks: EngineHooks;
  resolve: (result: EngineResult) => void;
  reject: (error: unknown) => void;
}

/** A pool whose "engine" only finishes work when the test says so. */
function controllablePool(concurrency: number) {
  const running: Deferred[] = [];
  let created = 0;
  const pool = new EnginePool((index): EngineClient => {
    created += 1;
    return {
      label: `#${index + 1}`,
      run: (request, hooks) =>
        new Promise<EngineResult>((resolve, reject) => {
          const entry = { request, hooks, resolve, reject };
          running.push(entry);
          hooks.signal?.addEventListener("abort", () => {
            running.splice(running.indexOf(entry), 1);
            reject(new ImageError("cancelled", "Cancelled."));
          });
        }),
      dispose: () => {},
    };
  }, concurrency);

  const finish = (entry: Deferred) => {
    running.splice(running.indexOf(entry), 1);
    entry.resolve({ type: "inspect" } as EngineResult);
  };
  return { pool, running, finish, clientsCreated: () => created };
}

const request = (name: string) => ({ type: "inspect", file: { name } as File, thumbnailMaxEdge: 1 }) as EngineRequest;
const nameOf = (entry: Deferred) => (entry.request as { file: File }).file.name;
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("EnginePool", () => {
  it("never runs more tasks than the concurrency limit", async () => {
    const { pool, running, finish } = controllablePool(2);
    const done = ["a", "b", "c", "d", "e"].map((name) => pool.run(request(name)));

    expect(running).toHaveLength(2);
    finish(running[0]);
    await tick();
    expect(running).toHaveLength(2);

    while (running.length > 0) {
      finish(running[0]);
      await tick();
    }
    await Promise.all(done);
  });

  it("reuses clients instead of creating one per task", async () => {
    const { pool, running, finish, clientsCreated } = controllablePool(2);
    const done = Array.from({ length: 6 }, (_, i) => pool.run(request(String(i))));
    while (running.length > 0) {
      finish(running[0]);
      await tick();
    }
    await Promise.all(done);
    expect(clientsCreated()).toBe(2);
  });

  it("runs high-priority tasks ahead of queued normal ones", async () => {
    const { pool, running, finish } = controllablePool(1);
    void pool.run(request("first"));
    void pool.run(request("normal"));
    void pool.run(request("urgent"), { priority: "high" });

    expect(nameOf(running[0])).toBe("first");
    finish(running[0]);
    await tick();
    expect(nameOf(running[0])).toBe("urgent");
  });

  it("heavy tasks take more of the budget", async () => {
    const { pool, running, finish } = controllablePool(2);
    void pool.run(request("heavy"), { weight: 2 });
    void pool.run(request("light"));
    expect(running.map(nameOf)).toEqual(["heavy"]);

    finish(running[0]);
    await tick();
    expect(running.map(nameOf)).toEqual(["light"]);
  });

  it("a task heavier than the whole budget still runs, alone", () => {
    const { pool, running } = controllablePool(1);
    void pool.run(request("huge"), { weight: 2 });
    expect(running).toHaveLength(1);
  });

  it("cancelling a queued task removes it without running it", async () => {
    const { pool, running, finish } = controllablePool(1);
    const controller = new AbortController();
    void pool.run(request("first"));
    const queued = pool.run(request("queued"), { signal: controller.signal });
    void pool.run(request("last"));

    controller.abort();
    await expect(queued).rejects.toMatchObject({ category: "cancelled" });

    finish(running[0]);
    await tick();
    expect(running.map(nameOf)).toEqual(["last"]);
  });

  it("cancelling a running task frees its slot for the next one", async () => {
    const { pool, running } = controllablePool(1);
    const controller = new AbortController();
    const active = pool.run(request("active"), { signal: controller.signal });
    void pool.run(request("next"));

    controller.abort();
    await expect(active).rejects.toMatchObject({ category: "cancelled" });
    await tick();
    expect(running.map(nameOf)).toEqual(["next"]);
  });

  it("one failing task does not stop the others", async () => {
    const { pool, running, finish } = controllablePool(1);
    const bad = pool.run(request("bad"));
    const good = pool.run(request("good"));

    running[0].reject(new ImageError("decode_failed", "nope"));
    running.shift();
    await expect(bad).rejects.toMatchObject({ category: "decode_failed" });
    await tick();
    finish(running[0]);
    await expect(good).resolves.toBeDefined();
  });

  it("rejects immediately for an already-aborted signal", async () => {
    const { pool, running } = controllablePool(1);
    const controller = new AbortController();
    controller.abort();
    await expect(pool.run(request("x"), { signal: controller.signal })).rejects.toMatchObject({ category: "cancelled" });
    expect(running).toHaveLength(0);
  });

  it("lowering concurrency applies to tasks that start afterwards", async () => {
    const { pool, running, finish } = controllablePool(4);
    for (let i = 0; i < 6; i++) void pool.run(request(String(i)));
    expect(running).toHaveLength(4);

    pool.setConcurrency(1);
    while (running.length > 1) {
      finish(running[0]);
      await tick();
    }
    expect(running).toHaveLength(1);
    finish(running[0]);
    await tick();
    expect(running).toHaveLength(1);
  });

  it("reports which client started a task", async () => {
    const { pool } = controllablePool(2);
    const labels: string[] = [];
    void pool.run(request("a"), { onStart: (label) => labels.push(label) });
    void pool.run(request("b"), { onStart: (label) => labels.push(label) });
    expect(labels).toEqual(["#1", "#2"]);
  });
});

describe("concurrency policy", () => {
  it("uses half the cores, capped at four", () => {
    expect(defaultConcurrency(16)).toBe(4);
    expect(defaultConcurrency(8)).toBe(4);
    expect(defaultConcurrency(4)).toBe(2);
    expect(defaultConcurrency(2)).toBe(1);
    expect(defaultConcurrency(1)).toBe(1);
  });

  it("is safe when the core count is unknown", () => {
    expect(defaultConcurrency(undefined)).toBe(1);
    expect(defaultConcurrency(Number.NaN)).toBe(1);
  });

  it("weights huge images double", () => {
    expect(taskWeight(12_000_000)).toBe(1);
    expect(taskWeight(50_000_000)).toBe(2);
  });

  it("steps down 4 → 2 → 1 and stays at 1", () => {
    expect(reducedConcurrency(4)).toBe(2);
    expect(reducedConcurrency(2)).toBe(1);
    expect(reducedConcurrency(1)).toBe(1);
  });
});
