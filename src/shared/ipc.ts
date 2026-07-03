// Shared IPC contract between the Electron main/preload and the renderer. Pure types
// only — no Electron/DOM/Node runtime — so both sides can import it.

export interface OpenedFile {
  readonly path: string;
  readonly content: string;
}

/** A debounced external disk change, with the attributed author and observation time. */
export interface ExternalChange {
  readonly content: string;
  /** Author of the change. `label` is display text; `id` is stable/extensible. */
  readonly author: { readonly id: string; readonly label: string };
  /** Epoch ms when the change was observed (drives the "· 2s ago" tooltip). */
  readonly at: number;
}

export interface WatchdownApi {
  /** The file opened at launch (CLI arg or dialog), or null if none was chosen. */
  openedFile(): Promise<OpenedFile | null>;
  /** Persist the given buffer to the open file. */
  save(content: string): Promise<void>;
  /** Subscribe to debounced external disk changes (new content + author + time). */
  onExternalChange(callback: (change: ExternalChange) => void): void;
}
