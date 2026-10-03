/**
 * Collects files from a drop, including the contents of dropped folders.
 *
 * Folder entries have to be requested synchronously during the drop event —
 * the DataTransfer is emptied as soon as the handler returns — so this grabs
 * every entry first and only then starts the asynchronous traversal.
 */
import { hintedFormat } from "./validation";

const MAX_FOLDER_FILES = 5000;

function readEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve) => reader.readEntries(resolve, () => resolve([])));
}

function entryFile(entry: FileSystemFileEntry): Promise<File | null> {
  return new Promise((resolve) => entry.file(resolve, () => resolve(null)));
}

async function collectFromDirectory(directory: FileSystemDirectoryEntry, out: File[]): Promise<void> {
  const reader = directory.createReader();
  // readEntries returns results in chunks; an empty chunk means done.
  for (;;) {
    const entries = await readEntries(reader);
    if (entries.length === 0) return;
    for (const entry of entries) {
      if (out.length >= MAX_FOLDER_FILES) return;
      if (entry.isDirectory) {
        await collectFromDirectory(entry as FileSystemDirectoryEntry, out);
      } else if (entry.isFile) {
        const file = await entryFile(entry as FileSystemFileEntry);
        // Folders are full of things that are not images (.DS_Store, sidecar
        // files); skip those quietly rather than listing each as an error.
        if (file && hintedFormat(file)) out.push(file);
      }
    }
  }
}

export async function filesFromDataTransfer(dataTransfer: DataTransfer): Promise<File[]> {
  const directFiles: File[] = [];
  const directories: FileSystemDirectoryEntry[] = [];

  const items = dataTransfer.items ? Array.from(dataTransfer.items) : [];
  if (items.length > 0 && typeof items[0].webkitGetAsEntry === "function") {
    for (const item of items) {
      if (item.kind !== "file") continue;
      const entry = item.webkitGetAsEntry();
      if (entry?.isDirectory) {
        directories.push(entry as FileSystemDirectoryEntry);
      } else {
        const file = item.getAsFile();
        if (file) directFiles.push(file);
      }
    }
  } else {
    directFiles.push(...Array.from(dataTransfer.files));
  }

  const fromFolders: File[] = [];
  for (const directory of directories) await collectFromDirectory(directory, fromFolders);
  return [...directFiles, ...fromFolders];
}

export function dragHasFiles(event: DragEvent): boolean {
  return !!event.dataTransfer && Array.from(event.dataTransfer.types).includes("Files");
}
