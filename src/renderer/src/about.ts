import type { UpdateCheckResult } from '../../shared/ipc.js';
import { openModal } from './modal.js';

const REPO_URL = 'https://github.com/mfozmen/watchdown';

// target=_blank routes through the main process's window-open handler, which only opens safe
// http(s) URLs in the OS browser.
function link(text: string, href: string): HTMLAnchorElement {
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.target = '_blank';
  anchor.rel = 'noreferrer';
  anchor.textContent = text;
  return anchor;
}

function renderResult(status: HTMLElement, result: UpdateCheckResult): void {
  status.dataset['state'] = result.status;
  if (result.status === 'available') {
    status.replaceChildren(
      `Version ${result.version} is available. `,
      link('Download', result.url),
    );
  } else if (result.status === 'current') {
    status.textContent = 'You have the latest version.';
  } else {
    status.textContent = "Couldn't reach GitHub. Try again later.";
  }
}

export function openAbout(): void {
  const modal = openModal('About Watchdown');
  if (!modal) return;
  const { dialog } = modal;

  const intro = document.createElement('p');
  intro.className = 'modal__intro';
  intro.textContent =
    'A markdown editor that shows, live, what AI coding tools change in the open file.';

  const version = document.createElement('p');
  version.className = 'about__version';

  const links = document.createElement('p');
  links.className = 'about__links';
  links.append(
    link('GitHub', REPO_URL),
    link('Release notes', `${REPO_URL}/releases`),
    link('MIT License', `${REPO_URL}/blob/main/LICENSE`),
  );

  const update = document.createElement('div');
  update.className = 'about__update';
  const check = document.createElement('button');
  check.type = 'button';
  check.className = 'modal__row-action';
  check.textContent = 'Check for updates';
  const status = document.createElement('span');
  status.className = 'about__update-status';
  status.setAttribute('role', 'status'); // announces the result without moving focus
  update.append(check, status);

  check.addEventListener('click', async () => {
    check.disabled = true;
    delete status.dataset['state'];
    status.textContent = 'Checking…';
    try {
      renderResult(status, await window.api.checkForUpdates());
    } finally {
      check.disabled = false;
    }
  });

  dialog.append(intro, version, links, update);
  void window.api.appVersion().then((v) => {
    version.textContent = `Version ${v}`;
  });
}
