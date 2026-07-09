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

/** A menu action handled by the renderer. 'save'/'save-as' need the current buffer;
 * 'manage-integrations' opens the Connection Manager modal. */
export type MenuAction = 'save' | 'save-as' | 'manage-integrations';

/** An AI-tool integration and whether its cooperative-authorship hook is currently installed. */
export interface IntegrationStatus {
  readonly id: string;
  readonly label: string;
  readonly connected: boolean;
}

export interface WatchdownApi {
  /** The file opened at launch (CLI arg or dialog), or null if none was chosen. */
  openedFile(): Promise<OpenedFile | null>;
  /** Persist the given buffer to the open file; resolves true on success, false if the write failed. */
  save(content: string): Promise<boolean>;
  /** Persist `content` to a path chosen via a Save As dialog; returns the new file, or null if cancelled. */
  saveAs(content: string): Promise<OpenedFile | null>;
  /** Report whether the buffer has unsaved changes, so main can guard Open before switching files. */
  setUnsaved(unsaved: boolean): void;
  /** Subscribe to debounced external disk changes (new content + author + time). */
  onExternalChange(callback: (change: ExternalChange) => void): void;
  /** A file was opened at runtime via the menu; replace the current document with it. */
  onOpened(callback: (file: OpenedFile) => void): void;
  /** A menu Save / Save As / Manage integrations was invoked. */
  onMenuAction(callback: (action: MenuAction) => void): void;
  /** The AI-tool integrations and their current connected state (for the Connection Manager). */
  listIntegrations(): Promise<IntegrationStatus[]>;
  /** Connect an integration by id (installs its hook, after a native confirmation); returns the
   * refreshed list. */
  connectIntegration(id: string): Promise<IntegrationStatus[]>;
  /** Disconnect an integration by id (removes its hook + helper); returns the refreshed list. */
  disconnectIntegration(id: string): Promise<IntegrationStatus[]>;
}
