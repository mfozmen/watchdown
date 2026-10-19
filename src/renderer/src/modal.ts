// DOM is built imperatively to stay CSP-safe (no innerHTML, no inline handlers).

export interface Modal {
  readonly dialog: HTMLElement;
  readonly closeButton: HTMLButtonElement;
  close(): void;
}

let openOverlay: HTMLElement | null = null;

function focusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'));
}

/** Open an accessible dialog shell (title, close, Esc, backdrop click, focus trap), or null if
 * one is already open — modals never stack. */
export function openModal(titleText: string): Modal | null {
  if (openOverlay) return null;
  const previouslyFocused = document.activeElement as HTMLElement | null;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const dialog = document.createElement('div');
  dialog.className = 'modal';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'modal-title');

  const header = document.createElement('div');
  header.className = 'modal__header';
  const title = document.createElement('h2');
  title.id = 'modal-title';
  title.className = 'modal__title';
  title.textContent = titleText;
  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'modal__close';
  closeButton.setAttribute('aria-label', 'Close');
  closeButton.textContent = '×';
  header.append(title, closeButton);

  dialog.append(header);
  overlay.append(dialog);
  (document.getElementById('modal-root') ?? document.body).append(overlay);
  openOverlay = overlay;

  const close = (): void => {
    overlay.remove();
    openOverlay = null;
    document.removeEventListener('keydown', onKeydown);
    previouslyFocused?.focus();
  };

  const onKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    const items = focusable(dialog);
    const first = items[0];
    const last = items.at(-1);
    if (!first || !last) return;
    // Focus can land outside (e.g. on <body> after a focused control is disabled); pull it back.
    if (!dialog.contains(document.activeElement)) {
      event.preventDefault();
      first.focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  closeButton.addEventListener('click', close);
  overlay.addEventListener('mousedown', (event) => {
    if (event.target === overlay) close(); // the backdrop, not the dialog
  });
  document.addEventListener('keydown', onKeydown);
  closeButton.focus();

  return { dialog, closeButton, close };
}
