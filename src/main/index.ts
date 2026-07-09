import { app, BrowserWindow, dialog, ipcMain, Menu, nativeTheme, session, shell } from 'electron';
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
import {
  addCursorHook,
  hasCursorHook,
  removeCursorHook,
  type CursorSettings,
} from '../core/cursor-hook.js';
import {
  addGeminiHook,
  hasGeminiHook,
  removeGeminiHook,
  type GeminiSettings,
} from '../core/gemini-hook.js';
import { attributedAuthor, canonicalizePath, parseSignal } from '../core/authorship-signal.js';
import { parseThemePreference, THEME_MODES, type ThemeMode } from '../core/theme-preference.js';
import type { ExternalChange, IntegrationStatus, MenuAction, OpenedFile } from '../shared/ipc.js';

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
const SIGNAL_FILE = join(WATCHDOWN_DIR, 'last-signal.json');
// Persisted app preferences (currently just the appearance mode).
const PREFERENCES_FILE = join(WATCHDOWN_DIR, 'preferences.json');
// The signal is written just before the disk change surfaces (hook fires post-edit, then our
// burst settle delays the read), so match generously against the observation time.
const SIGNAL_WINDOW_MS = 5000;

// Standalone glue run by Claude Code (a separate node process), so it imports nothing of ours:
// read the hook payload on stdin, record ONLY the edited file path (never file contents/diffs)
// plus a timestamp and author. The tested pure core (parseSignal) validates and matches it.
const CLAUDE_HOOK_SCRIPT_SOURCE = `import { mkdirSync, writeFileSync } from 'node:fs';
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

/**
 * An AI-tool integration: the tool's settings file, the hook script we run for it, and the pure
 * per-tool settings-merge functions (typed to that tool's shape in the core). Adding a tool is
 * one entry here plus its core merge module — the menu, modal, and IPC are all registry-driven.
 */
interface Integration {
  readonly id: string;
  readonly label: string;
  readonly settingsPath: string;
  readonly hookScriptPath: string;
  readonly hookScriptSource: string;
  readonly confirmDetail: string;
  readonly hasHook: (settings: Record<string, unknown>) => boolean;
  readonly addHook: (settings: Record<string, unknown>) => Record<string, unknown>;
  readonly removeHook: (settings: Record<string, unknown>) => Record<string, unknown>;
}

const CLAUDE_SETTINGS = join(homedir(), '.claude', 'settings.json');
const CLAUDE_HOOK_SCRIPT = join(WATCHDOWN_DIR, 'claude-hook.mjs');
const CLAUDE_HOOK_COMMAND = `node "${CLAUDE_HOOK_SCRIPT}"`;

const claudeIntegration: Integration = {
  id: 'claude-code',
  label: 'Claude Code',
  settingsPath: CLAUDE_SETTINGS,
  hookScriptPath: CLAUDE_HOOK_SCRIPT,
  hookScriptSource: CLAUDE_HOOK_SCRIPT_SOURCE,
  // Global settings on purpose: attribute whichever file is open, regardless of which project
  // Claude Code runs from. The hook fires on every Claude edit machine-wide — cheap and harmless
  // (Watchdown only reacts to the open file) — and the confirmation says so.
  confirmDetail:
    `Watchdown will add a PostToolUse hook to your global Claude settings (${CLAUDE_SETTINGS}). ` +
    `It runs on every Claude Code edit on this machine and records which file was touched, so ` +
    `edits to the file open in Watchdown are attributed to "Claude Code" rather than a generic ` +
    `label. It changes nothing else. Disconnect any time from the Connection Manager.`,
  hasHook: (settings) => hasClaudeHook(settings as ClaudeSettings),
  addHook: (settings) => addClaudeHook(settings as ClaudeSettings, CLAUDE_HOOK_COMMAND),
  removeHook: (settings) => removeClaudeHook(settings as ClaudeSettings),
};

// Cursor announces edits via an afterFileEdit hook in ~/.cursor/hooks.json (user-level = global).
// Its payload carries the edited file at the TOP-LEVEL file_path (unlike Claude's tool_input),
// so the hook script's extraction differs; the recorded signal is the same shape.
const CURSOR_SETTINGS = join(homedir(), '.cursor', 'hooks.json');
const CURSOR_HOOK_SCRIPT = join(WATCHDOWN_DIR, 'cursor-hook.mjs');
const CURSOR_HOOK_COMMAND = `node "${CURSOR_HOOK_SCRIPT}"`;

const CURSOR_HOOK_SCRIPT_SOURCE = `import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => (input += chunk));
process.stdin.on('end', () => {
  try {
    const file = JSON.parse(input)?.file_path;
    if (typeof file === 'string' && file !== '') {
      const dir = join(homedir(), '.watchdown');
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'last-signal.json'),
        JSON.stringify({ ts: Date.now(), author: 'Cursor', file }));
    }
  } catch {
    // Never disrupt Cursor.
  }
  process.stdout.write('{}'); // Cursor expects a JSON response on stdout; empty is fine, exit 0
});
`;

const cursorIntegration: Integration = {
  id: 'cursor',
  label: 'Cursor',
  settingsPath: CURSOR_SETTINGS,
  hookScriptPath: CURSOR_HOOK_SCRIPT,
  hookScriptSource: CURSOR_HOOK_SCRIPT_SOURCE,
  confirmDetail:
    `Watchdown will add an afterFileEdit hook to your global Cursor settings (${CURSOR_SETTINGS}). ` +
    `It runs on every file the Cursor agent edits and records which file was touched, so edits to ` +
    `the file open in Watchdown are attributed to "Cursor" rather than a generic label. It changes ` +
    `nothing else. Disconnect any time from the Connection Manager.`,
  hasHook: (settings) => hasCursorHook(settings as CursorSettings),
  addHook: (settings) => addCursorHook(settings as CursorSettings, CURSOR_HOOK_COMMAND),
  removeHook: (settings) => removeCursorHook(settings as CursorSettings),
};

// Gemini CLI announces edits via an AfterTool hook in ~/.gemini/settings.json (user-level =
// global). Its settings shape matches Claude's (nested matcher+hooks); the file is at
// tool_input.file_path for the write_file/replace tools. Gemini requires the hook to print only
// JSON to stdout ({"continue": true}), so the script does exactly that.
const GEMINI_SETTINGS = join(homedir(), '.gemini', 'settings.json');
const GEMINI_HOOK_SCRIPT = join(WATCHDOWN_DIR, 'gemini-hook.mjs');
const GEMINI_HOOK_COMMAND = `node "${GEMINI_HOOK_SCRIPT}"`;

const GEMINI_HOOK_SCRIPT_SOURCE = `import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => (input += chunk));
process.stdin.on('end', () => {
  try {
    const file = JSON.parse(input)?.tool_input?.file_path;
    if (typeof file === 'string' && file !== '') {
      const dir = join(homedir(), '.watchdown');
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'last-signal.json'),
        JSON.stringify({ ts: Date.now(), author: 'Gemini CLI', file }));
    }
  } catch {
    // Never disrupt Gemini CLI.
  }
  process.stdout.write('{"continue":true}'); // Gemini requires JSON-only stdout
});
`;

const geminiIntegration: Integration = {
  id: 'gemini-cli',
  label: 'Gemini CLI',
  settingsPath: GEMINI_SETTINGS,
  hookScriptPath: GEMINI_HOOK_SCRIPT,
  hookScriptSource: GEMINI_HOOK_SCRIPT_SOURCE,
  confirmDetail:
    `Watchdown will add an AfterTool hook to your global Gemini CLI settings (${GEMINI_SETTINGS}). ` +
    `It runs when Gemini CLI writes or edits a file and records which file was touched, so edits to ` +
    `the file open in Watchdown are attributed to "Gemini CLI" rather than a generic label. It ` +
    `changes nothing else. Disconnect any time from the Connection Manager.`,
  hasHook: (settings) => hasGeminiHook(settings as GeminiSettings),
  addHook: (settings) => addGeminiHook(settings as GeminiSettings, GEMINI_HOOK_COMMAND),
  removeHook: (settings) => removeGeminiHook(settings as GeminiSettings),
};

const INTEGRATIONS: readonly Integration[] = [
  claudeIntegration,
  cursorIntegration,
  geminiIntegration,
];

let mainWindow: BrowserWindow | null = null;
// Current appearance mode (drives the View → Appearance radio and nativeTheme.themeSource).
let themeMode: ThemeMode = 'system';
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

/** Read a tool's JSON settings file, or {} if absent; throw on any file we can't understand
 * (unreadable, malformed JSON, or valid JSON that isn't an object) so we never overwrite and
 * lose it. */
async function readSettingsFile(path: string): Promise<Record<string, unknown>> {
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw err;
  }
  const parsed: unknown = JSON.parse(text); // throws on malformed JSON — caller surfaces it
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`Settings file is not a JSON object: ${path}`);
  }
  return parsed as Record<string, unknown>;
}

/** Write JSON to `path` atomically (temp file + rename) so a crash mid-write can't corrupt a
 * user's shared config (Claude settings) or our own preferences. */
async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.watchdown.tmp`;
  await writeFile(tmp, JSON.stringify(value, null, 2) + '\n', 'utf8');
  await rename(tmp, path); // atomic on the same filesystem
}

/** Read the persisted appearance mode, defaulting to 'system' when absent or unreadable. */
async function readThemeMode(): Promise<ThemeMode> {
  try {
    const parsed: unknown = JSON.parse(await readFile(PREFERENCES_FILE, 'utf8'));
    return parseThemePreference((parsed as Record<string, unknown> | null)?.['theme']);
  } catch {
    return 'system';
  }
}

/** Apply and persist an appearance mode. themeSource drives the renderer's prefers-color-scheme
 * (and thus the whole token UI); the editor surface reacts via matchMedia in the renderer. */
async function setThemeMode(mode: ThemeMode): Promise<void> {
  themeMode = mode;
  nativeTheme.themeSource = mode;
  buildMenu(); // reflect the newly-checked radio
  try {
    await writeJsonAtomic(PREFERENCES_FILE, { theme: mode });
  } catch (err) {
    showError('Could not save the appearance preference', String(err));
  }
}

/** Whether an integration's hook is currently installed (false on any unreadable/bad settings). */
async function isConnected(integration: Integration): Promise<boolean> {
  try {
    return integration.hasHook(await readSettingsFile(integration.settingsPath));
  } catch {
    return false;
  }
}

/** Write (or refresh) the standalone hook script the tool runs. */
async function writeIntegrationHookScript(integration: Integration): Promise<void> {
  await mkdir(WATCHDOWN_DIR, { recursive: true });
  await writeFile(integration.hookScriptPath, integration.hookScriptSource, 'utf8');
}

/** Install the integration's hook (script + settings entry). Assumes the user already consented. */
async function connectIntegration(integration: Integration): Promise<void> {
  await writeIntegrationHookScript(integration);
  const settings = await readSettingsFile(integration.settingsPath);
  if (!integration.hasHook(settings)) {
    await writeJsonAtomic(integration.settingsPath, integration.addHook(settings));
  }
}

/** Remove the integration's hook (settings entry + helper script). */
async function disconnectIntegration(integration: Integration): Promise<void> {
  const settings = await readSettingsFile(integration.settingsPath);
  if (integration.hasHook(settings)) {
    await writeJsonAtomic(integration.settingsPath, integration.removeHook(settings));
  }
  await rm(integration.hookScriptPath, { force: true });
  // Drop any pending signal so a stale one can't attribute the next edit to a tool we just
  // disconnected (within the match window). It's shared and transient — a connected tool
  // rewrites it on its next edit.
  await rm(SIGNAL_FILE, { force: true });
}

/** Current connected state of every registered integration (for the Connection Manager). */
function integrationStatuses(): Promise<IntegrationStatus[]> {
  return Promise.all(
    INTEGRATIONS.map(async (integration) => ({
      id: integration.id,
      label: integration.label,
      connected: await isConnected(integration),
    })),
  );
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
    {
      label: 'View',
      submenu: [
        {
          label: 'Appearance',
          submenu: THEME_MODES.map((mode) => ({
            label: mode.charAt(0).toUpperCase() + mode.slice(1), // System / Light / Dark
            type: 'radio' as const,
            checked: themeMode === mode,
            click: () => void setThemeMode(mode),
          })),
        },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        // Deliberately omit Reload/Force Reload from the default viewMenu role: reloading the
        // renderer would silently discard the unsaved editor buffer. DevTools stays for debugging.
        { role: 'toggleDevTools' },
      ],
    },
    { role: 'windowMenu' },
    {
      label: 'Tools',
      submenu: [
        {
          label: 'Manage integrations…',
          click: () => sendAction('manage-integrations'),
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

ipcMain.handle('integrations:list', (): Promise<IntegrationStatus[]> => integrationStatuses());

ipcMain.handle('integrations:connect', async (_event, id: string): Promise<IntegrationStatus[]> => {
  const integration = INTEGRATIONS.find((entry) => entry.id === id);
  if (integration) {
    // Consent stays in the main process (a native dialog), not the renderer modal.
    const options = {
      type: 'question' as const,
      buttons: ['Cancel', 'Connect'],
      defaultId: 1,
      cancelId: 0,
      message: `Connect ${integration.label}?`,
      detail: integration.confirmDetail,
    };
    const { response } = mainWindow
      ? await dialog.showMessageBox(mainWindow, options)
      : await dialog.showMessageBox(options);
    if (response === 1) {
      try {
        await connectIntegration(integration);
      } catch (err) {
        showError(`Could not connect ${integration.label}`, String(err));
      }
    }
  }
  return integrationStatuses();
});

ipcMain.handle(
  'integrations:disconnect',
  async (_event, id: string): Promise<IntegrationStatus[]> => {
    const integration = INTEGRATIONS.find((entry) => entry.id === id);
    if (integration) {
      try {
        await disconnectIntegration(integration);
      } catch (err) {
        showError(`Could not disconnect ${integration.label}`, String(err));
      }
    }
    return integrationStatuses();
  },
);

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
  themeMode = await readThemeMode(); // apply the saved appearance before the first paint
  nativeTheme.themeSource = themeMode;
  buildMenu();
  // Self-heal: for each connected integration, (re)write its hook script so it survives manual
  // deletion and stays current across app updates (the settings entry alone would else no-op).
  for (const integration of INTEGRATIONS) {
    if (await isConnected(integration)) {
      await writeIntegrationHookScript(integration).catch(() => undefined);
    }
  }
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
