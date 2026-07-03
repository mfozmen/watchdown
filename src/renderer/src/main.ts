import { EditorView, keymap } from '@codemirror/view';
import { Prec } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { basicSetup } from 'codemirror';
import { loadDocument, type SessionStatus } from '../../core/document-session.js';
import { reconcileExternalChange } from '../../core/external-sync.js';
import { attributeExternalChange, type Author } from '../../core/attribution.js';
import { NO_PRESENCE, recordExternalWrite, presenceAt } from '../../core/presence.js';
import { attributionExtension, applyAttribution } from './attribution.js';
import './style.css';

const STATUS_LABEL: Record<SessionStatus, string> = {
  clean: 'Saved',
  dirty: 'Unsaved changes',
  conflict: 'Conflict — both versions kept',
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

  const file = await window.api.openedFile();
  const initial = file?.content ?? '';
  const session = loadDocument(initial);
  pathEl.textContent = file?.path ?? 'No file open';

  // Distinguish programmatic reloads from user typing so we don't treat a reload as a local edit.
  let applyingExternal = false;

  // Presence: which external author is actively writing the file, derived in the pure core.
  let presence = NO_PRESENCE;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;

  function renderStatus(): void {
    statusEl.dataset['status'] = session.status;
    labelEl.textContent = STATUS_LABEL[session.status];
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
    // drop the preserved side. Interactive resolution is a later phase; the badge stands.
    if (session.status === 'conflict') return;
    const content = view.state.doc.toString();
    await window.api.save(content);
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

  const view = new EditorView({
    parent: editorParent,
    doc: initial,
    extensions: [
      basicSetup,
      markdown(),
      attributionExtension(),
      Prec.highest(
        keymap.of([
          {
            key: 'Mod-s',
            preventDefault: true,
            run: () => {
              void save();
              return true;
            },
          },
        ]),
      ),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && !applyingExternal) {
          session.applyLocalEdit(update.state.doc.toString());
          renderStatus();
        }
      }),
    ],
  });

  window.api.onExternalChange((change) => {
    markPresence(change.author, change.at); // any external write drives the presence badge
    const previous = view.state.doc.toString();
    const outcome = reconcileExternalChange(session, change.content);
    if (outcome.kind === 'reload') {
      reload(outcome.content);
      // Attribute what actually changed in the editor to the external author.
      const attribution = attributeExternalChange(previous, outcome.content, change.author);
      applyAttribution(view, attribution.ranges, change.author.label, change.at);
    }
    renderStatus(); // a conflict outcome leaves the buffer; the status bar shows the badge
  });

  renderStatus();
}

void boot();
