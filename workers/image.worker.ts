/// <reference lib="webworker" />
/**
 * Image worker. Runs one engine request at a time; the pool on the main
 * thread decides how many of these exist. Cancellation is cooperative: the
 * engine checks its AbortSignal between the async decode/encode steps, and
 * the pool terminates the worker outright if that takes too long.
 */
import { runEngineRequest } from "@/lib/image/engine";
import { toProcessingError } from "@/lib/image/errors";
import type { EngineResult, FromWorkerMessage, ToWorkerMessage } from "@/lib/processing/protocol";

const scope = self as unknown as DedicatedWorkerGlobalScope;
const controllers = new Map<number, AbortController>();

function post(message: FromWorkerMessage, transfer: Transferable[] = []): void {
  scope.postMessage(message, transfer);
}

/** ImageBitmaps are moved, not copied. Blobs are cheap handles and need no transfer. */
function transferables(result: EngineResult): Transferable[] {
  if (result.type === "preview" && typeof ImageBitmap !== "undefined" && result.image instanceof ImageBitmap) {
    return [result.image];
  }
  return [];
}

scope.onmessage = async (event: MessageEvent<ToWorkerMessage>) => {
  const message = event.data;

  if (message.kind === "cancel") {
    controllers.get(message.id)?.abort();
    return;
  }

  const { id, request } = message;
  const controller = new AbortController();
  controllers.set(id, controller);
  try {
    const result = await runEngineRequest(request, {
      signal: controller.signal,
      onStage: (stage) => post({ kind: "stage", id, stage }),
    });
    post({ kind: "done", id, result }, transferables(result));
  } catch (error) {
    post({ kind: "failed", id, error: toProcessingError(error) });
  } finally {
    controllers.delete(id);
  }
};
