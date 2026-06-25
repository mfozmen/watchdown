import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { join } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { watch, type FSWatcher } from 'chokidar';
import { actionForWatchEvent, type WatchEvent } from '../core/watch-event.js';
import { NO_BURST, recordWrite, isBursting, type BurstState } from '../core/write-burst.js';
import type { OpenedFile } from '../shared/ipc.js';

// Settle window for external write bursts (atomic saves arrive as unlink+add; AI tools
// may write several times rapidly). We reload once the burst quiets.
const QUIET_MS = 250;

let mainWindow: BrowserWindow | null = null;
let watcher: FSWatcher | null = null;
let openedFile: OpenedFile | null = null;
// Suppress the watcher echo from our own save by remembering what we last wrote.
let lastWrittenContent: string | null = null;

let burst: BurstState = NO_BURST;
let settleTimer: ReturnType<typeof setTimeout> | null = null;

/** Pick the file to open: a .md path from the CLI, else a native open dialog. */
async function resolveTargetFile(): Promise<string | null> {
  const argPath = process.argv.slice(1).find((arg) => arg.endsWith('.md'));
  if (argPath) return argPath;
  const result = await dialog.showOpenDialog({
    title: 'Open a Markdown file',
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
    properties: ['openFile'],
  });
  return result.canceled || result.filePaths.length === 0 ? null : (result.filePaths[0] ?? null);
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 980,
    height: 720,
    show: false,
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.once('ready-to-show', () => win.show());
  const devUrl = process.env['ELECTRON_RENDERER_URL'];
  if (devUrl) void win.loadURL(devUrl);
  else void win.loadFile(join(import.meta.dirname, '../renderer/index.html'));
  return win;
}

/** Read the watched file and push it to the renderer, unless it's our own save echo. */
async function readAndPush(): Promise<void> {
  if (!openedFile) return;
  const content = await readFile(openedFile.path, 'utf8');
  if (content === lastWrittenContent) return;
  mainWindow?.webContents.send('file:external-change', content);
}

/** Debounce watcher events through the pure burst tracker, acting once the burst settles. */
function onWatchEvent(event: WatchEvent): void {
  if (actionForWatchEvent(event) !== 'reload') return; // unlink: await the rewrite
  burst = recordWrite(burst, Date.now(), QUIET_MS);
  if (settleTimer) clearTimeout(settleTimer);
  settleTimer = setTimeout(() => {
    if (!isBursting(burst, Date.now(), QUIET_MS)) void readAndPush();
  }, QUIET_MS + 20);
}

function startWatching(filePath: string): void {
  watcher = watch(filePath, { ignoreInitial: true });
  watcher.on('add', () => onWatchEvent('add'));
  watcher.on('change', () => onWatchEvent('change'));
  watcher.on('unlink', () => onWatchEvent('unlink'));
}

ipcMain.handle('file:opened', (): OpenedFile | null => openedFile);

ipcMain.handle('file:save', async (_event, content: string): Promise<void> => {
  if (!openedFile) return;
  lastWrittenContent = content;
  await writeFile(openedFile.path, content, 'utf8');
});

app.whenReady().then(async () => {
  const target = await resolveTargetFile();
  if (target) {
    const content = await readFile(target, 'utf8');
    openedFile = { path: target, content };
    lastWrittenContent = content;
  }
  mainWindow = createWindow();
  if (target) startWatching(target);
});

app.on('window-all-closed', () => {
  void watcher?.close();
  if (process.platform !== 'darwin') app.quit();
});
