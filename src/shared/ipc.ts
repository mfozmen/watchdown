// Shared IPC contract between the Electron main/preload and the renderer. Pure types
// only — no Electron/DOM/Node runtime — so both sides can import it.

export interface OpenedFile {
  readonly path: string;
  readonly content: string;
}

export interface WatchdownApi {
  /** The file opened at launch (CLI arg or dialog), or null if none was chosen. */
  openedFile(): Promise<OpenedFile | null>;
  /** Persist the given buffer to the open file. */
  save(content: string): Promise<void>;
  /** Subscribe to debounced external disk changes; the callback receives new file content. */
  onExternalChange(callback: (content: string) => void): void;
}
