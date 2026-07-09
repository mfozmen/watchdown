import type { IntegrationStatus } from '../../shared/ipc.js';

// The Connection Manager modal: lists AI-tool integrations with their connected state and a
// Connect/Disconnect action, driven by the main-process registry over IPC. DOM is built
// imperatively so it's CSP-safe (no innerHTML, no inline handlers). One instance at a time;
// Escape, the close button, or a click outside the dialog dismisses it. The actual hook
// install/uninstall (and the consent dialog) happen in the main process.

let openOverlay: HTMLElement | null = null;

/** Collect the currently-focusable controls inside the dialog, for the focus trap. */
function focusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('button:not([disabled])'));
}

export function openConnectionManager(): void {
  if (openOverlay) return; // already open — don't stack
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
  title.textContent = 'Integrations';
  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'modal__close';
  closeButton.setAttribute('aria-label', 'Close');
  closeButton.textContent = '×'; // ×
  header.append(title, closeButton);

  const intro = document.createElement('p');
  intro.className = 'modal__intro';
  intro.textContent =
    'Connect an AI coding tool so its edits to the open file are attributed to it in real time.';

  const list = document.createElement('ul');
  list.className = 'modal__list';

  dialog.append(header, intro, list);
  overlay.append(dialog);
  (document.getElementById('modal-root') ?? document.body).append(overlay);
  openOverlay = overlay;

  const close = (): void => {
    overlay.remove();
    openOverlay = null;
    document.removeEventListener('keydown', onKeydown);
    previouslyFocused?.focus();
  };

  const setBusy = (busy: boolean): void => {
    for (const button of dialog.querySelectorAll('button')) button.disabled = busy;
  };

  const renderRows = (integrations: IntegrationStatus[]): void => {
    list.replaceChildren();
    for (const integration of integrations) {
      const row = document.createElement('li');
      row.className = 'modal__row';

      const info = document.createElement('div');
      info.className = 'modal__row-info';
      const label = document.createElement('span');
      label.className = 'modal__row-label';
      label.textContent = integration.label;
      const status = document.createElement('span');
      status.className = 'modal__row-status';
      status.dataset['connected'] = String(integration.connected);
      status.textContent = integration.connected ? 'Connected' : 'Not connected';
      info.append(label, status);

      const action = document.createElement('button');
      action.type = 'button';
      action.className = 'modal__row-action';
      action.textContent = integration.connected ? 'Disconnect' : 'Connect';
      action.addEventListener('click', () => void toggle(integration));

      row.append(info, action);
      list.append(row);
    }
  };

  const toggle = async (integration: IntegrationStatus): Promise<void> => {
    setBusy(true);
    try {
      const updated = integration.connected
        ? await window.api.disconnectIntegration(integration.id)
        : await window.api.connectIntegration(integration.id);
      renderRows(updated);
    } finally {
      setBusy(false);
    }
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
    const last = items[items.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  closeButton.addEventListener('click', close);
  overlay.addEventListener('mousedown', (event) => {
    if (event.target === overlay) close(); // click on the backdrop, not the dialog
  });
  document.addEventListener('keydown', onKeydown);

  void window.api.listIntegrations().then(renderRows);
  closeButton.focus();
}
