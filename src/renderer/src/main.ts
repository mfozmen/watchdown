import { EditorView, keymap } from '@codemirror/view';
import { Prec } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { basicSetup } from 'codemirror';
import { loadDocument, type SessionStatus } from '../../core/document-session.js';
import { reconcileExternalChange } from '../../core/external-sync.js';
import './style.css';

const STATUS_LABEL: Record<SessionStatus, string> = {
  clean: 'Saved',
  dirty: 'Unsaved changes',
  conflict: 'Conflict — both versions kept',
};

function must<T>(value: T | null, what: string): T {
  if (value === null) throw new Error(`missing element: ${what}`);
  return value;
}

async function boot(): Promise<void> {
  const editorParent = must(document.getElementById('editor'), 'editor');
  const statusEl = must(document.getElementById('status'), 'status');
  const labelEl = must(statusEl.querySelector('.status__label'), 'status label');
  const pathEl = must(statusEl.querySelector('.status__path'), 'status path');

  const file = await window.api.openedFile();
  const initial = file?.content ?? '';
  const session = loadDocument(initial);
  pathEl.textContent = file?.path ?? 'No file open';

  // Distinguish programmatic reloads from user typing so we don't treat a reload as a local edit.
  let applyingExternal = false;

  function renderStatus(): void {
    statusEl.dataset['status'] = session.status;
    labelEl.textContent = STATUS_LABEL[session.status];
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

  window.api.onExternalChange((content) => {
    const outcome = reconcileExternalChange(session, content);
    if (outcome.kind === 'reload') reload(outcome.content);
    renderStatus(); // a conflict outcome leaves the buffer; the status bar shows the badge
  });

  renderStatus();
}

void boot();
