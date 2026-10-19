export type WatchEvent = 'add' | 'change' | 'unlink';
export type WatchAction = 'reload' | 'await-rewrite';

/** Decide what the adapter should do for a watched-file event. */
export function actionForWatchEvent(event: WatchEvent): WatchAction {
  // unlink is usually the first half of an atomic write; wait for the add/change instead
  // of reading an absent/empty file.
  return event === 'unlink' ? 'await-rewrite' : 'reload';
}
