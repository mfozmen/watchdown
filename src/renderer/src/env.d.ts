/// <reference types="vite/client" />
import type { WatchdownApi } from '../../shared/ipc.js';

declare global {
  interface Window {
    readonly api: WatchdownApi;
  }
}
