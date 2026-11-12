// Decides whether a running macOS bundle should copy itself into the user's own Applications
// folder, which any account can write, unlike /Applications.

export interface UserInstallPlan {
  readonly bundle: string;
  readonly target: string;
}

/** The copy to make for the app running at `execPath`, or null when it should stay where it is. */
export function userInstallPlan(execPath: string, home: string): UserInstallPlan | null {
  const bundle = /^(.+\.app)\/Contents\/MacOS\/[^/]+$/.exec(execPath)?.[1];
  const userApps = `${home.replace(/\/+$/, '')}/Applications`;
  if (!bundle || userApps === '/Applications') return null;
  const installed = [userApps, '/Applications'].some((dir) => bundle.startsWith(`${dir}/`));
  return installed ? null : { bundle, target: `${userApps}/Watchdown.app` };
}
