import { app, BrowserWindow, dialog, ipcMain, Menu, session, shell } from 'electron';
import type { MenuItemConstructorOptions } from 'electron';
import { join } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { watch, type FSWatcher } from 'chokidar';
import { isSafeExternalUrl } from '../core/external-link.js';
import { actionForWatchEvent, type WatchEvent } from '../core/watch-event.js';
import { NO_BURST, recordWrite, isBursting, type BurstState } from '../core/write-burst.js';
import { NO_ECHO, recordSave, classifyDiskChange, type EchoState } from '../core/save-echo.js';
import type { ExternalChange, MenuAction, OpenedFile } from '../shared/ipc.js';

// Settle window for external write bursts (atomic saves arrive as unlink+add; AI tools
// may write several times rapidly). We reload once the burst quiets.
const QUIET_MS = 250;

// A disk write only tells us the file changed, not which tool did it — attribute to a
// generic external author. (Detecting the specific tool is future work.)
const EXTERNAL_AUTHOR = { id: 'external', label: 'an external tool' } as const;

let mainWindow: BrowserWindow | null = null;
let watcher: FSWatcher | null = null;
let openedFile: OpenedFile | null = null;
// Suppress the watcher echo from our own save; the decision logic is a pure core helper.
let echo: EchoState = NO_ECHO;
// The renderer reports whether it has unsaved edits, so Open can guard before switching files.
let unsaved = false;

let burst: BurstState = NO_BURST;

/** Show the native "open a .md" dialog (shared by startup and menu File → Open). */
function openMarkdownDialog(): Promise<Electron.OpenDialogReturnValue> {
  return dialog.showOpenDialog({
    title: 'Open a Markdown file',
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
    properties: ['openFile'],
  });
}

/** Pick the file to open: a .md path from the CLI, else a native open dialog. */
async function resolveTargetFile(): Promise<string | null> {
  const argPath = process.argv.slice(1).find((arg) => arg.endsWith('.md'));
  if (argPath) return argPath;
  const result = await openMarkdownDialog();
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
  win.on('closed', () => {
    // Drop the reference so a late settle-timer send can't hit a destroyed window.
    mainWindow = null;
  });
  // Preview links can come from untrusted external writes: never let one navigate the app
  // window; hand safe (http/https) URLs to the OS browser and deny everything else.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (url === win.webContents.getURL()) return; // allow our own (re)load
    event.preventDefault();
    if (isSafeExternalUrl(url)) void shell.openExternal(url);
  });
  const devUrl = process.env['ELECTRON_RENDERER_URL'];
  if (devUrl) void win.loadURL(devUrl);
  else void win.loadFile(join(import.meta.dirname, '../renderer/index.html'));
  return win;
}

/** Read the watched file and push it to the renderer, unless it's our own save echo. */
async function readAndPush(): Promise<void> {
  if (!openedFile) return;
  try {
    const content = await readFile(openedFile.path, 'utf8');
    const { suppress, next } = classifyDiskChange(echo, content);
    echo = next;
    if (suppress) return;
    const change: ExternalChange = { content, author: EXTERNAL_AUTHOR, at: Date.now() };
    mainWindow?.webContents.send('file:external-change', change);
  } catch {
    // File momentarily absent (mid atomic write); the follow-up add/change re-reads.
  }
}

/** Deliver a strict CSP via response header for the packaged file:// load (Vite serves
 * its own headers in dev). script-src stays 'self'; style-src allows inline because
 * CodeMirror injects its theme as an inline <style>. */
function applyCsp(): void {
  if (process.env['ELECTRON_RENDERER_URL']) return;
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
            "object-src 'none'; base-uri 'none'",
        ],
      },
    });
  });
}

/** Debounce watcher events through the pure burst tracker, acting once the burst settles. */
function onWatchEvent(event: WatchEvent): void {
  if (actionForWatchEvent(event) !== 'reload') return; // unlink: await the rewrite
  burst = recordWrite(burst, Date.now(), QUIET_MS);
  // One settle check per event; only the check after the burst's final write finds
  // isBursting false and reads — earlier checks see a newer write and skip.
  setTimeout(() => {
    if (!isBursting(burst, Date.now(), QUIET_MS)) void readAndPush();
  }, QUIET_MS + 20);
}

/** Watch `filePath`, replacing any previous watcher (Open / Save As switch the target). */
function watchFile(filePath: string): void {
  void watcher?.close();
  burst = NO_BURST;
  watcher = watch(filePath, { ignoreInitial: true });
  watcher.on('add', () => onWatchEvent('add'));
  watcher.on('change', () => onWatchEvent('change'));
  watcher.on('unlink', () => onWatchEvent('unlink'));
}

/** Native prompt before discarding unsaved edits; true = discard and proceed. */
async function confirmDiscard(): Promise<boolean> {
  if (!mainWindow) return true;
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    buttons: ['Cancel', 'Discard changes'],
    defaultId: 0,
    cancelId: 0,
    message: 'Discard unsaved changes?',
    detail: 'The current file has unsaved changes that will be lost if you open another file.',
  });
  return response === 1;
}

/** Open a dialog-chosen file into the running window (menu File → Open). */
async function openViaDialog(): Promise<void> {
  const result = await openMarkdownDialog();
  const path = result.canceled ? null : (result.filePaths[0] ?? null);
  if (!path) return;
  // Confirm BEFORE mutating any file/watcher state, so cancelling leaves the session intact.
  if (unsaved && !(await confirmDiscard())) return;
  openedFile = { path, content: await readFile(path, 'utf8') };
  echo = NO_ECHO; // a freshly opened file has no pending save of ours to suppress
  watchFile(path);
  mainWindow?.webContents.send('file:opened-runtime', openedFile);
}

/** Build and install the application menu. */
function buildMenu(): void {
  const isMac = process.platform === 'darwin';
  const sendAction = (action: MenuAction): void => {
    mainWindow?.webContents.send('menu:action', action);
  };
  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: 'appMenu' as const }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'Open…', accelerator: 'CmdOrCtrl+O', click: () => void openViaDialog() },
        { type: 'separator' },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => sendAction('save') },
        { label: 'Save As…', accelerator: 'CmdOrCtrl+Shift+S', click: () => sendAction('save-as') },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        {
          label: 'Watchdown on GitHub',
          click: () => void shell.openExternal('https://github.com/mfozmen/watchdown'),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

ipcMain.on('ui:unsaved', (_event, value: boolean) => {
  unsaved = value;
});

ipcMain.handle('file:opened', (): OpenedFile | null => openedFile);

ipcMain.handle('file:save', async (_event, content: string): Promise<void> => {
  if (!openedFile) return;
  echo = recordSave(content);
  await writeFile(openedFile.path, content, 'utf8');
});

ipcMain.handle('file:save-as', async (_event, content: string): Promise<OpenedFile | null> => {
  const result = await dialog.showSaveDialog({
    title: 'Save Markdown as',
    ...(openedFile ? { defaultPath: openedFile.path } : {}),
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
  });
  const path = result.canceled ? undefined : result.filePath;
  if (!path) return null;
  echo = recordSave(content); // our own write — suppress its watcher echo
  await writeFile(path, content, 'utf8');
  openedFile = { path, content };
  watchFile(path);
  return openedFile;
});

app.whenReady().then(async () => {
  applyCsp();
  const target = await resolveTargetFile();
  if (target) {
    // Startup only reads; no save is pending, so the echo state stays NO_ECHO.
    openedFile = { path: target, content: await readFile(target, 'utf8') };
  }
  mainWindow = createWindow();
  buildMenu();
  if (target) watchFile(target);
});

app.on('activate', () => {
  // macOS: re-create the window when the dock icon is clicked and none are open.
  if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow();
});

app.on('window-all-closed', () => {
  void watcher?.close();
  if (process.platform !== 'darwin') app.quit();
});
