let counter = 0;

/** Unique within the session. Never derived from filenames. */
export function createId(prefix: string): string {
  counter += 1;
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${counter.toString(36)}${random}`;
}
