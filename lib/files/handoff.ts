/**
 * Carries files dropped on another page into the workspace.
 *
 * A client-side navigation keeps the page's JavaScript alive, so the File
 * objects can simply wait here until the workspace mounts and takes them.
 * If the navigation turns out to be a full page load instead, this module
 * starts empty and the workspace opens with no images — the same as
 * arriving by link. Nothing is serialised, stored or sent anywhere.
 */
let pending: File[] = [];

export function stashFiles(files: File[]): void {
  pending = files;
}

/** Returns the waiting files and forgets them, so they are only ever added once. */
export function takeStashedFiles(): File[] {
  const files = pending;
  pending = [];
  return files;
}
