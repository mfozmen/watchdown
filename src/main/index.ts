import { app, BrowserWindow, dialog, ipcMain, Menu, session, shell } from 'electron';
import type { MenuItemConstructorOptions } from 'electron';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { watch, type FSWatcher } from 'chokidar';
import { isSafeExternalUrl } from '../core/external-link.js';
import { resolveAuthorLabel } from '../core/author-label.js';
import { actionForWatchEvent, type WatchEvent } from '../core/watch-event.js';
import { NO_BURST, recordWrite, isBursting, type BurstState } from '../core/write-burst.js';
import { NO_ECHO, recordSave, classifyDiskChange, type EchoState } from '../core/save-echo.js';
import {
  addClaudeHook,
  hasClaudeHook,
  removeClaudeHook,
  type ClaudeSettings,
} from '../core/claude-hook.js';
import { attributedAuthor, canonicalizePath, parseSignal } from '../core/authorship-signal.js';
import type { ExternalChange, MenuAction, OpenedFile } from '../shared/ipc.js';

// Settle window for external write bursts (atomic saves arrive as unlink+add; AI tools
// may write several times rapidly). We reload once the burst quiets.
const QUIET_MS = 250;

// A disk write carries no author, so the tool can't be detected — the label is configurable
// via --author "Claude" / WATCHDOWN_AUTHOR (else a generic default), driving the presence
// badge and attribution ("Claude is editing…" / "Changed by Claude").
const EXTERNAL_AUTHOR = {
  id: 'external',
  label: resolveAuthorLabel(process.argv, process.env['WATCHDOWN_AUTHOR']),
} as const;

// Cooperative authorship: when the user connects Claude Code, we add a PostToolUse hook to
// their Claude settings that writes a signal (which file it edited, when) into ~/.watchdown.
// A disk change whose signal matches is attributed exactly to "Claude Code" instead of the
// generic label — no guessing. All of this is opt-in via the Tools menu and reversible.
const WATCHDOWN_DIR = join(homedir(), '.watchdown');
const HOOK_SCRIPT = join(WATCHDOWN_DIR, 'claude-hook.mjs');
const SIGNAL_FILE = join(WATCHDOWN_DIR, 'last-signal.json');
const CLAUDE_SETTINGS = join(homedir(), '.claude', 'settings.json');
const HOOK_COMMAND = `node "${HOOK_SCRIPT}"`;
// The signal is written just before the disk change surfaces (hook fires post-edit, then our
// burst settle delays the read), so match generously against the observation time.
const SIGNAL_WINDOW_MS = 5000;

// Standalone glue run by Claude Code (a separate node process), so it imports nothing of ours:
// read the hook payload on stdin, record ONLY the edited file path (never file contents/diffs)
// plus a timestamp and author. The tested pure core (parseSignal) validates and matches it.
const HOOK_SCRIPT_SOURCE = `import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => (input += chunk));
process.stdin.on('end', () => {
  try {
    const file = JSON.parse(input)?.tool_input?.file_path;
    if (typeof file !== 'string' || file === '') return;
    const dir = join(homedir(), '.watchdown');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'last-signal.json'),
      JSON.stringify({ ts: Date.now(), author: 'Claude Code', file }));
  } catch {
    // Never let a hook error disrupt Claude Code.
  }
});
`;

let mainWindow: BrowserWindow | null = null;
// Whether our PostToolUse hook is installed in the user's Claude settings (drives the menu).
let claudeConnected = false;
let watcher: FSWatcher | null = null;
let openedFile: OpenedFile | null = null;
// Suppress the watcher echo from our own save; the decision logic is a pure core helper.
let echo: EchoState = NO_ECHO;
// The renderer reports whether it has unsaved edits, so Open can guard before switching files.
let unsaved = false;

let burst: BurstState = NO_BURST;
// Bumped whenever the watched file switches; a settle-timer from a previous file checks this
// so it can't read+push the newly-opened file's content as a spurious external change.
let watchGeneration = 0;

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
    // Show our W↓ icon in the running app (dev + Linux window/taskbar). Resolve relative to
    // this file (out/main) like the preload/renderer paths below: ../../build-resources is the
    // project root in dev and the asar root when packaged (Electron reads the bundled png from
    // asar). Windows/macOS packaged builds use the embedded exe/bundle icon regardless.
    icon: join(import.meta.dirname, '../../build-resources/icon.png'),
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
  const generation = watchGeneration;
  const changedPath = openedFile.path;
  try {
    const content = await readFile(changedPath, 'utf8');
    if (generation !== watchGeneration) return; // file switched during the read; drop it
    const { suppress, next } = classifyDiskChange(echo, content);
    echo = next;
    if (suppress) return;
    const author = await resolveExternalAuthor(changedPath);
    if (generation !== watchGeneration) return; // file switched while resolving; drop it
    const change: ExternalChange = { content, author, at: Date.now() };
    mainWindow?.webContents.send('file:external-change', change);
  } catch {
    // File momentarily absent (mid atomic write); the follow-up add/change re-reads.
  }
}

/** Resolve to an absolute path (needs cwd), then canonicalize case via the pure core helper. */
function normalizePath(path: string): string {
  return canonicalizePath(resolve(path), process.platform);
}

/** Attribute the change to Claude Code if a matching cooperative signal exists, else the
 * configured label. Both paths are normalized so the hook's path and ours compare equal. */
async function resolveExternalAuthor(changedPath: string): Promise<ExternalChange['author']> {
  try {
    const signal = parseSignal(await readFile(SIGNAL_FILE, 'utf8'));
    const normalized = signal ? { ...signal, file: normalizePath(signal.file) } : null;
    const label = attributedAuthor(normalized, normalizePath(changedPath), Date.now(), SIGNAL_WINDOW_MS);
    if (label) {
      // Consume it (best-effort) so a later unrelated edit to the same file can't reuse it and
      // be misattributed. A cleanup failure must not downgrade a correct attribution, so its
      // error is swallowed here rather than reaching the outer fallback.
      await rm(SIGNAL_FILE, { force: true }).catch(() => undefined);
      return { id: 'claude-code', label };
    }
  } catch {
    // No signal file (not connected / no edit yet) or unreadable → fall back.
  }
  return EXTERNAL_AUTHOR;
}

/** Read the user's Claude settings, or {} if absent; throw on any file we can't understand
 * (unreadable, malformed JSON, or valid JSON that isn't an object) so we never overwrite and
 * lose it. */
async function readClaudeSettings(): Promise<ClaudeSettings> {
  let text: string;
  try {
    text = await readFile(CLAUDE_SETTINGS, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw err;
  }
  const parsed: unknown = JSON.parse(text); // throws on malformed JSON — caller surfaces it
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Claude settings file is not a JSON object');
  }
  return parsed as ClaudeSettings;
}

/** Write the user's Claude settings atomically (temp file + rename) so a crash mid-write can't
 * corrupt their global, shared config. */
async function writeClaudeSettings(settings: ClaudeSettings): Promise<void> {
  await mkdir(dirname(CLAUDE_SETTINGS), { recursive: true });
  const tmp = `${CLAUDE_SETTINGS}.watchdown.tmp`;
  await writeFile(tmp, JSON.stringify(settings, null, 2) + '\n', 'utf8');
  await rename(tmp, CLAUDE_SETTINGS); // atomic on the same filesystem
}

async function detectClaudeConnected(): Promise<boolean> {
  try {
    return hasClaudeHook(await readClaudeSettings());
  } catch {
    return false; // unreadable/malformed settings — treat as not connected
  }
}

/** Write (or refresh) the standalone hook script that Claude Code runs. */
async function writeHookScript(): Promise<void> {
  await mkdir(WATCHDOWN_DIR, { recursive: true });
  await writeFile(HOOK_SCRIPT, HOOK_SCRIPT_SOURCE, 'utf8');
}

/**
 * Add the PostToolUse hook to the user's Claude settings, after explicit confirmation. We use
 * the *global* settings (`~/.claude/settings.json`) on purpose: Watchdown should attribute
 * whichever file the user has open, regardless of which project Claude Code runs from. The
 * hook therefore fires on every Claude edit machine-wide — cheap (spawns node, writes one
 * small file) and harmless (Watchdown only reacts to edits of the open file) — and the dialog
 * says so.
 */
async function connectClaudeCode(): Promise<void> {
  const { response } = await dialog.showMessageBox({
    type: 'question',
    buttons: ['Cancel', 'Connect'],
    defaultId: 1,
    cancelId: 0,
    message: 'Connect Claude Code?',
    detail:
      `Watchdown will add a PostToolUse hook to your global Claude settings (${CLAUDE_SETTINGS}). ` +
      `It runs on every Claude Code edit on this machine and records which file was touched, so ` +
      `edits to the file open in Watchdown are attributed to "Claude Code" rather than a generic ` +
      `label. It changes nothing else. Disconnect any time from the Tools menu.`,
  });
  if (response !== 1) return;
  try {
    await writeHookScript();
    const settings = await readClaudeSettings();
    if (!hasClaudeHook(settings)) await writeClaudeSettings(addClaudeHook(settings, HOOK_COMMAND));
    claudeConnected = true;
    buildMenu();
  } catch (err) {
    showError('Could not connect to Claude Code', String(err));
  }
}

/** Remove our hook from the user's Claude settings and clean up our helper files. */
async function disconnectClaudeCode(): Promise<void> {
  try {
    const settings = await readClaudeSettings();
    if (hasClaudeHook(settings)) await writeClaudeSettings(removeClaudeHook(settings));
    await rm(HOOK_SCRIPT, { force: true });
    await rm(SIGNAL_FILE, { force: true });
    claudeConnected = false;
    buildMenu();
  } catch (err) {
    showError('Could not disconnect from Claude Code', String(err));
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
  const generation = watchGeneration;
  // One settle check per event; only the check after the burst's final write finds
  // isBursting false and reads — earlier checks see a newer write and skip.
  setTimeout(() => {
    if (generation !== watchGeneration) return; // file switched since scheduling; drop stale timer
    if (!isBursting(burst, Date.now(), QUIET_MS)) void readAndPush();
  }, QUIET_MS + 20);
}

/** Watch `filePath`, replacing any previous watcher (Open / Save As switch the target). */
async function watchFile(filePath: string): Promise<void> {
  await watcher?.close(); // fully close the old watcher first so no straggler event leaks through
  burst = NO_BURST;
  watchGeneration++; // invalidate any settle-timer still pending against the previous file
  watcher = watch(filePath, { ignoreInitial: true });
  watcher.on('add', () => onWatchEvent('add'));
  watcher.on('change', () => onWatchEvent('change'));
  watcher.on('unlink', () => onWatchEvent('unlink'));
}

/** Surface a file-operation failure to the user instead of failing silently. */
function showError(message: string, detail: string): void {
  const options = { type: 'error' as const, message, detail };
  // Show a parentless dialog when the window is gone (macOS: menu stays live with no window).
  void (mainWindow ? dialog.showMessageBox(mainWindow, options) : dialog.showMessageBox(options));
}

/** Native prompt before discarding unsaved edits; true = discard and proceed. */
async function confirmDiscard(): Promise<boolean> {
  const options = {
    type: 'warning' as const,
    buttons: ['Cancel', 'Discard changes'],
    defaultId: 0,
    cancelId: 0,
    message: 'Discard unsaved changes?',
    detail: 'The current file has unsaved changes that will be lost if you open another file.',
  };
  // Always ask (parentless if the window is gone) — never silently auto-discard.
  const { response } = mainWindow
    ? await dialog.showMessageBox(mainWindow, options)
    : await dialog.showMessageBox(options);
  return response === 1;
}

/** Open a dialog-chosen file into the running window (menu File → Open). */
async function openViaDialog(): Promise<void> {
  const result = await openMarkdownDialog();
  const path = result.canceled ? null : (result.filePaths[0] ?? null);
  if (!path) return;
  // Confirm BEFORE mutating any file/watcher state, so cancelling leaves the session intact.
  if (unsaved && !(await confirmDiscard())) return;
  let content: string;
  try {
    content = await readFile(path, 'utf8');
  } catch (err) {
    showError('Could not open the file', String(err));
    return;
  }
  openedFile = { path, content };
  echo = NO_ECHO; // a freshly opened file has no pending save of ours to suppress
  unsaved = false; // it's clean now — don't wait for the renderer round-trip to clear this
  await watchFile(path);
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
      label: 'Tools',
      submenu: [
        {
          label: 'Connect Claude Code…',
          enabled: !claudeConnected,
          click: () => void connectClaudeCode(),
        },
        {
          label: 'Disconnect Claude Code',
          enabled: claudeConnected,
          click: () => void disconnectClaudeCode(),
        },
      ],
    },
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

ipcMain.handle('file:save', async (_event, content: string): Promise<boolean> => {
  if (!openedFile) return false;
  try {
    await writeFile(openedFile.path, content, 'utf8');
    echo = recordSave(content); // arm the echo only after the write actually lands
    return true;
  } catch (err) {
    showError('Could not save the file', String(err));
    return false;
  }
});

ipcMain.handle('file:save-as', async (_event, content: string): Promise<OpenedFile | null> => {
  const result = await dialog.showSaveDialog({
    title: 'Save Markdown as',
    ...(openedFile ? { defaultPath: openedFile.path } : {}),
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
  });
  const path = result.canceled ? undefined : result.filePath;
  if (!path) return null;
  try {
    await writeFile(path, content, 'utf8');
    echo = recordSave(content); // arm the echo only after the write actually lands
  } catch (err) {
    showError('Could not save the file', String(err));
    return null;
  }
  openedFile = { path, content };
  unsaved = false; // buffer now matches the newly written file
  await watchFile(path);
  return openedFile;
});

app.whenReady().then(async () => {
  applyCsp();
  const target = await resolveTargetFile();
  if (target) {
    // Startup only reads; no save is pending, so the echo state stays NO_ECHO.
    try {
      openedFile = { path: target, content: await readFile(target, 'utf8') };
    } catch (err) {
      showError('Could not open the file', String(err));
    }
  }
  mainWindow = createWindow();
  claudeConnected = await detectClaudeConnected(); // reflect existing connection in the menu
  // Self-heal: if connected, (re)write the hook script so it survives manual deletion and stays
  // current across app updates (the settings entry alone would otherwise silently no-op).
  if (claudeConnected) await writeHookScript().catch(() => undefined);
  buildMenu();
  if (openedFile) await watchFile(openedFile.path); // only watch what we actually read
});

app.on('activate', () => {
  // macOS: re-create the window when the dock icon is clicked and none are open.
  if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow();
});

app.on('window-all-closed', () => {
  void watcher?.close();
  if (process.platform !== 'darwin') app.quit();
});
