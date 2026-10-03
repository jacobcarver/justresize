/** True when the event target is somewhere typing means entering text, so single-key shortcuts must stay out of the way. */
export function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || target.tagName === "TEXTAREA" || target.tagName === "SELECT") return true;
  if (target instanceof HTMLInputElement) return !["radio", "checkbox", "range", "button", "color", "file"].includes(target.type);
  return false;
}

/** How a Ctrl/⌘ keyboard shortcut is written on this device, e.g. "⌘O" or "Ctrl+O". Client only. */
export function shortcut(key: string): string {
  const apple = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);
  return apple ? `⌘${key}` : `Ctrl+${key}`;
}
