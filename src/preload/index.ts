import { contextBridge, ipcRenderer } from 'electron';
import type { ExternalChange, MenuAction, OpenedFile, WatchdownApi } from '../shared/ipc.js';

// Minimal, explicit surface exposed to the renderer via contextBridge. The renderer
// never touches fs or ipc directly — only these calls.
const api: WatchdownApi = {
  openedFile: (): Promise<OpenedFile | null> => ipcRenderer.invoke('file:opened'),
  save: (content: string): Promise<void> => ipcRenderer.invoke('file:save', content),
  saveAs: (content: string): Promise<OpenedFile | null> =>
    ipcRenderer.invoke('file:save-as', content),
  onExternalChange: (callback: (change: ExternalChange) => void): void => {
    ipcRenderer.on('file:external-change', (_event, change: ExternalChange) => callback(change));
  },
  onOpened: (callback: (file: OpenedFile) => void): void => {
    ipcRenderer.on('file:opened-runtime', (_event, file: OpenedFile) => callback(file));
  },
  onMenuAction: (callback: (action: MenuAction) => void): void => {
    ipcRenderer.on('menu:action', (_event, action: MenuAction) => callback(action));
  },
};

contextBridge.exposeInMainWorld('api', api);
