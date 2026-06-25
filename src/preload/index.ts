import { contextBridge, ipcRenderer } from 'electron';
import type { OpenedFile, WatchdownApi } from '../shared/ipc.js';

// Minimal, explicit surface exposed to the renderer via contextBridge. The renderer
// never touches fs or ipc directly — only these three calls.
const api: WatchdownApi = {
  openedFile: (): Promise<OpenedFile | null> => ipcRenderer.invoke('file:opened'),
  save: (content: string): Promise<void> => ipcRenderer.invoke('file:save', content),
  onExternalChange: (callback: (content: string) => void): void => {
    ipcRenderer.on('file:external-change', (_event, content: string) => callback(content));
  },
};

contextBridge.exposeInMainWorld('api', api);
