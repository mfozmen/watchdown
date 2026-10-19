import type { IntegrationStatus } from '../../shared/ipc.js';
import { openModal } from './modal.js';

// Hook install/uninstall and the consent dialog live in the main process.

export function openConnectionManager(): void {
  const modal = openModal('Integrations');
  if (!modal) return;
  const { dialog, closeButton } = modal;

  const intro = document.createElement('p');
  intro.className = 'modal__intro';
  intro.textContent =
    'Connect an AI coding tool so its edits to the open file are attributed to it in real time.';

  const list = document.createElement('ul');
  list.className = 'modal__list';

  dialog.append(intro, list);

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
      action.dataset['id'] = integration.id; // to restore focus to this row after a re-render
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
      // renderRows replaced the clicked button; return focus inside the dialog (its rebuilt row,
      // else the close button) so focus never escapes the aria-modal dialog.
      const rebuilt = dialog.querySelector<HTMLButtonElement>(
        `.modal__row-action[data-id="${CSS.escape(integration.id)}"]`,
      );
      (rebuilt ?? closeButton).focus();
    }
  };

  void window.api.listIntegrations().then(renderRows);
}
