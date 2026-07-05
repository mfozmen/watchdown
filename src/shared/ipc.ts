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

/** A menu action that needs the renderer's current buffer to carry out. */
export type MenuAction = 'save' | 'save-as';

export interface WatchdownApi {
  /** The file opened at launch (CLI arg or dialog), or null if none was chosen. */
  openedFile(): Promise<OpenedFile | null>;
  /** Persist the given buffer to the open file. */
  save(content: string): Promise<void>;
  /** Persist `content` to a path chosen via a Save As dialog; returns the new file, or null if cancelled. */
  saveAs(content: string): Promise<OpenedFile | null>;
  /** Ask (native dialog) whether to discard unsaved changes; true = discard and proceed. */
  confirmDiscard(): Promise<boolean>;
  /** Subscribe to debounced external disk changes (new content + author + time). */
  onExternalChange(callback: (change: ExternalChange) => void): void;
  /** A file was opened at runtime via the menu; replace the current document with it. */
  onOpened(callback: (file: OpenedFile) => void): void;
  /** A menu Save / Save As was invoked; the renderer supplies its current buffer. */
  onMenuAction(callback: (action: MenuAction) => void): void;
}
