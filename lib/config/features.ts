/** Simple compile-time feature flags. No remote flag infrastructure. */
export const FEATURES = {
  /** AVIF output via the lazily loaded WASM encoder (or native where a browser has one). */
  avif: true,
  /** WebP output via WASM when the browser's canvas cannot encode it (Safari). */
  wasmWebp: true,
  /**
   * No bundled HEIC decoder yet. HEIC files are still accepted when the
   * browser itself can decode them (Safari); elsewhere they are rejected
   * with an honest message.
   */
  heicWasm: false,
  multiOutput: true,
  clipboardPaste: true,
} as const;

function runtimeDebugFlag(): boolean {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem("justresize:debug") === "1";
  } catch {
    return false;
  }
}

/**
 * Debug mode: timing logs in the console and the debug panel under the app.
 * On in development; in a production build it can be switched on for one
 * browser with `localStorage.setItem("justresize:debug", "1")` and a reload,
 * or for a whole deployment with NEXT_PUBLIC_DEBUG=true.
 */
export const DEBUG =
  process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_DEBUG === "true" || runtimeDebugFlag();
