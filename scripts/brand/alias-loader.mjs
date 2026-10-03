/**
 * Lets the brand export import the site's own TypeScript modules with Node:
 * resolves the "@/..." alias from tsconfig.json to the repository root, and
 * adds the ".ts" that the bundler would otherwise supply. Registered by
 * export.mjs; nothing else uses it.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export function resolve(specifier, context, nextResolve) {
  const base = specifier.startsWith("@/")
    ? path.join(root, specifier.slice(2))
    : specifier.startsWith(".") && context.parentURL?.startsWith("file:")
      ? path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier)
      : null;
  if (base && !path.extname(base)) {
    for (const candidate of [`${base}.ts`, path.join(base, "index.ts")]) {
      if (existsSync(candidate)) return nextResolve(pathToFileURL(candidate).href, context);
    }
  }
  return nextResolve(specifier, context);
}
