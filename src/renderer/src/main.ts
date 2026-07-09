import { EditorView } from '@codemirror/view';
import { Compartment, type Extension } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import { basicSetup } from 'codemirror';
import DOMPurify from 'dompurify';
import { loadDocument, type SessionStatus } from '../../core/document-session.js';
import { reconcileExternalChange } from '../../core/external-sync.js';
import { attributeExternalChange, type Author } from '../../core/attribution.js';
import { NO_PRESENCE, recordExternalWrite, presenceAt } from '../../core/presence.js';
import { renderMarkdown } from '../../core/markdown.js';
import { windowTitle } from '../../core/window-title.js';
import { scrollRatio, scrollTopForRatio } from '../../core/scroll-sync.js';
import { attributionExtension, applyAttribution } from './attribution.js';
import { conflictResolver, showConflicts, clearConflicts } from './conflict.js';
import type { ExternalChange, MenuAction, OpenedFile } from '../../shared/ipc.js';
import './style.css';

const STATUS_LABEL: Record<SessionStatus, string> = {
  clean: 'Saved',
  dirty: 'Unsaved changes',
  conflict: 'Conflict — resolve the highlighted regions',
};

// How long "…is editing" lingers after the last external write before falling back to
// idle. This is a UX display duration, deliberately independent of the main process's
// burst-settle window (QUIET_MS in src/main/index.ts): it only needs to sit comfortably
// above it so the badge holds steady across the gaps between a tool's successive settled
// writes instead of flickering on and off — not derived from it.
const PRESENCE_LINGER_MS = 1500;
// Re-check for idle just past the linger so the elapsed time strictly exceeds it.
const PRESENCE_IDLE_GUARD_MS = 100;

function must<T>(value: T | null, what: string): T {
  if (value === null) throw new Error(`missing element: ${what}`);
  return value;
}

async function boot(): Promise<void> {
  const editorParent = must(document.getElementById('editor'), 'editor');
  const statusEl = must(document.getElementById('status'), 'status');
  const labelEl = must(statusEl.querySelector('.status__label'), 'status label');
  const pathEl = must(statusEl.querySelector('.status__path'), 'status path');
  const presenceEl = must(statusEl.querySelector<HTMLElement>('.status__presence'), 'presence');
  const presenceTextEl = must(
    presenceEl.querySelector<HTMLElement>('.status__presence-text'),
    'presence text',
  );
  const previewEl = must(document.getElementById('preview'), 'preview');

  const file = await window.api.openedFile();
  const initial = file?.content ?? '';
  let session = loadDocument(initial);
  let currentPath = file?.path ?? null;
  pathEl.textContent = currentPath ?? 'No file open';

  // Distinguish programmatic reloads from user typing so we don't treat a reload as a local edit.
  let applyingExternal = false;

  // Presence: which external author is actively writing the file, derived in the pure core.
  let presence = NO_PRESENCE;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let lastUnsavedSent: boolean | null = null;
  // Scroll sync is bidirectional; record each programmatic scrollTop we set so the resulting
  // scroll event isn't mistaken for a user scroll and echoed back (which would ping-pong).
  let programmaticEditorTop = -1;
  let programmaticPreviewTop = -1;
  // An external write that arrived while a conflict resolution is in progress; applied (latest
  // wins) once resolution completes, so it's neither dropped nor allowed to reset progress.
  let pendingExternal: ExternalChange | null = null;

  function renderStatus(): void {
    statusEl.dataset['status'] = session.status;
    labelEl.textContent = STATUS_LABEL[session.status];
    const unsaved = session.status !== 'clean';
    document.title = windowTitle(currentPath, unsaved);
    // Tell main only on transitions, so it can guard Open against discarding these edits.
    if (unsaved !== lastUnsavedSent) {
      lastUnsavedSent = unsaved;
      window.api.setUnsaved(unsaved);
    }
  }

  function renderPreview(): void {
    // Sanitize markdown-it's (already html:false) output as defense in depth before it
    // reaches the DOM. Keep the reader's scroll position across the re-render.
    const html = DOMPurify.sanitize(renderMarkdown(view.state.doc.toString()));
    const scrollTop = previewEl.scrollTop;
    previewEl.innerHTML = html;
    previewEl.scrollTop = scrollTop;
    programmaticPreviewTop = previewEl.scrollTop; // restore isn't a user scroll — don't drive the editor
  }

  // Coalesce a burst of doc changes (fast typing, a large paste, a full external reload)
  // into a single render per animation frame, so we don't re-parse/re-sanitize per keystroke.
  let previewFrame = 0;
  function scheduleRenderPreview(): void {
    if (previewFrame) return;
    previewFrame = requestAnimationFrame(() => {
      previewFrame = 0;
      renderPreview();
    });
  }

  function renderPresence(): void {
    const now = Date.now(); // clock lives in the adapter; the core stays timer-free
    const p = presenceAt(presence, now, PRESENCE_LINGER_MS);
    const text = p.status === 'editing' ? `${p.author.label ?? 'An external tool'} is editing…` : '';
    // Only touch the DOM when the text actually changes, so the aria-live status region
    // announces "…is editing" once — not on every write within the same burst.
    if (text === presenceTextEl.textContent) return;
    presenceTextEl.textContent = text;
    presenceEl.hidden = text === '';
  }

  // Any external write means that tool is actively editing (even if it lands as a conflict).
  // Record it and (re)arm the timer that clears the badge once the writes stop.
  function markPresence(author: Author, at: number): void {
    presence = recordExternalWrite(presence, author, at, PRESENCE_LINGER_MS);
    renderPresence();
    clearTimeout(idleTimer);
    idleTimer = setTimeout(renderPresence, PRESENCE_LINGER_MS + PRESENCE_IDLE_GUARD_MS);
  }

  async function save(): Promise<void> {
    // Never save while in conflict: writing our buffer would overwrite theirs on disk and
    // drop the preserved side. Resolve the highlighted regions first (via the resolver
    // widgets); the buffer becomes saveable again once every region is resolved.
    if (session.status === 'conflict') return;
    // No file yet (startup dialog cancelled): fall back to Save As so we don't mark the
    // session "saved" without ever writing to disk.
    if (currentPath === null) {
      await saveAs();
      return;
    }
    const content = view.state.doc.toString();
    const ok = await window.api.save(content);
    if (!ok) return; // write failed (main surfaced the error) — don't claim it's saved
    // Record the saved content as the disk baseline. If the user typed during the IPC
    // round-trip the buffer has moved on, so this correctly stays dirty (not a conflict).
    session.markSaved(content);
    renderStatus();
  }

  // Replace the whole document while preserving cursor (clamped) and scroll offset.
  function reload(content: string): void {
    const scrollTop = view.scrollDOM.scrollTop;
    const caret = Math.min(view.state.selection.main.head, content.length);
    applyingExternal = true;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: content },
      selection: { anchor: caret },
    });
    applyingExternal = false;
    view.scrollDOM.scrollTop = scrollTop;
  }

  // Load a different file into the running window (menu File → Open): reset the buffer,
  // session, presence, and author markers, and jump to the top.
  function openFile(opened: OpenedFile): void {
    // Main confirms any discard before pushing this, so just apply the newly opened file.
    session = loadDocument(opened.content);
    currentPath = opened.path;
    pathEl.textContent = opened.path;
    applyingExternal = true;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: opened.content },
      selection: { anchor: 0 },
    });
    applyingExternal = false;
    view.scrollDOM.scrollTop = 0;
    applyAttribution(view, [], '', 0); // new file: clear any external-author markers
    clearConflicts(view);
    pendingExternal = null; // drop any write held for the previous file — it must not reach this one
    presence = NO_PRESENCE;
    clearTimeout(idleTimer);
    renderPresence();
    renderStatus();
    previewEl.scrollTop = 0; // new file starts at the top — don't depend on a scroll event firing
    renderPreview();
  }

  async function saveAs(): Promise<void> {
    if (session.status === 'conflict') return; // resolve the highlighted regions first
    const content = view.state.doc.toString();
    const saved = await window.api.saveAs(content);
    if (!saved) return; // dialog cancelled
    currentPath = saved.path;
    pathEl.textContent = saved.path;
    session.markSaved(saved.content); // the newly written file now matches the buffer
    renderStatus();
  }

  // The editor surface follows the effective color scheme (which nativeTheme.themeSource drives
  // from the main process): one-dark when dark, CodeMirror's default light otherwise. The rest
  // of the UI flips automatically via the CSS `prefers-color-scheme` tokens; only the editor
  // needs this bridge. darkSurface nudges one-dark's background to the app's slate so the pane
  // matches the surrounding chrome.
  const themeCompartment = new Compartment();
  const colorScheme = window.matchMedia('(prefers-color-scheme: dark)');
  const darkSurface = EditorView.theme(
    {
      '&': { backgroundColor: 'var(--bg)' },
      '.cm-gutters': { backgroundColor: 'var(--bg)', borderRightColor: 'var(--border)' },
    },
    { dark: true },
  );
  const editorTheme = (isDark: boolean): Extension => (isDark ? [oneDark, darkSurface] : []);

  const view = new EditorView({
    parent: editorParent,
    doc: initial,
    extensions: [
      basicSetup,
      themeCompartment.of(editorTheme(colorScheme.matches)),
      markdown(),
      attributionExtension(),
      conflictResolver(() => {
        // Last region resolved: adopt the merged buffer, leaving it dirty over theirs.
        session.acceptResolution(view.state.doc.toString());
        clearConflicts(view); // reset the resolver state now that nothing is unresolved
        renderStatus();
        renderPreview();
        if (pendingExternal) {
          // Apply the write(s) that landed during resolution (latest wins) now that it's safe.
          const next = pendingExternal;
          pendingExternal = null;
          reconcileAndRender(next);
        }
      }),
      // Ctrl/Cmd+S is owned by the File → Save menu accelerator (single source of truth),
      // so there's no in-editor Mod-s binding here — that would double-fire save().
      EditorView.updateListener.of((update) => {
        if (!update.docChanged) return;
        if (!applyingExternal) {
          session.applyLocalEdit(update.state.doc.toString());
          renderStatus();
        }
        scheduleRenderPreview(); // reflect local edits AND external reloads/merges, coalesced
      }),
    ],
  });

  // Re-theme the editor when the effective scheme flips (OS change under "System", or a manual
  // Light/Dark from the menu, both surfaced here via themeSource → prefers-color-scheme).
  colorScheme.addEventListener('change', (event) => {
    view.dispatch({ effects: themeCompartment.reconfigure(editorTheme(event.matches)) });
  });

  // Link the two panes: scrolling either moves the other to the same proportional position.
  // Each programmatic set is recorded so its own scroll event is ignored (no ping-pong).
  const syncOtherPane = (from: HTMLElement, to: HTMLElement): number => {
    const ratio = scrollRatio(from.scrollTop, from.scrollHeight, from.clientHeight);
    to.scrollTop = scrollTopForRatio(ratio, to.scrollHeight, to.clientHeight);
    return to.scrollTop; // the value to record as programmatic for the target pane
  };
  view.scrollDOM.addEventListener('scroll', () => {
    if (view.scrollDOM.scrollTop === programmaticEditorTop) {
      programmaticEditorTop = -1; // our own set — consume the echo, don't drive the preview
      return;
    }
    programmaticPreviewTop = syncOtherPane(view.scrollDOM, previewEl);
  });
  previewEl.addEventListener('scroll', () => {
    if (previewEl.scrollTop === programmaticPreviewTop) {
      programmaticPreviewTop = -1;
      return;
    }
    programmaticEditorTop = syncOtherPane(previewEl, view.scrollDOM);
  });

  function reconcileAndRender(change: ExternalChange): void {
    const previous = view.state.doc.toString();
    const outcome = reconcileExternalChange(session, change.content);
    if (outcome.kind === 'reload') {
      reload(outcome.content);
      clearConflicts(view); // back in sync — drop any resolver overlay
      // Attribute what actually changed in the editor to the external author.
      const attribution = attributeExternalChange(previous, outcome.content, change.author);
      applyAttribution(view, attribution.ranges, change.author.label, change.at);
    } else {
      // Conflict: the buffer keeps our side; overlay the interactive resolver on each region.
      showConflicts(view, outcome.segments, change.author.label);
    }
    renderStatus();
  }

  window.api.onExternalChange((change) => {
    markPresence(change.author, change.at); // any external write drives the presence badge
    // While a conflict is unresolved, reconciling now would recompute a fresh overlay and reset
    // the user's per-region progress. Hold the latest write; apply it once resolved. (session
    // status is the single source of truth, same gate as save()/saveAs().)
    if (session.status === 'conflict') {
      pendingExternal = change;
      return;
    }
    reconcileAndRender(change);
  });

  window.api.onOpened((opened) => openFile(opened));
  window.api.onMenuAction((action: MenuAction) => {
    if (action === 'save') void save();
    else void saveAs();
  });

  renderStatus();
  renderPreview();
}

void boot();
