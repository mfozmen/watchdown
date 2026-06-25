// Pure mapping from a watched-file event to the adapter's intended action. Keeps the
// chokidar handler trivial. Atomic writes (often unlink followed by add) are handled by
// awaiting the rewrite on unlink rather than clobbering the buffer with an empty file.

export type WatchEvent = 'add' | 'change' | 'unlink';
export type WatchAction = 'reload' | 'await-rewrite';

/** Decide what the adapter should do for a watched-file event. */
export function actionForWatchEvent(_event: WatchEvent): WatchAction {
  throw new Error('actionForWatchEvent is not implemented yet');
}
