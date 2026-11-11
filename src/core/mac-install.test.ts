import { describe, expect, it } from 'vitest';
import { userInstallPlan } from './mac-install.js';

const HOME = '/Users/ada';
const exe = (bundleDir: string) => `${bundleDir}/Watchdown.app/Contents/MacOS/Watchdown`;

describe('userInstallPlan', () => {
  it('installs a copy opened from the disk image into ~/Applications', () => {
    expect(userInstallPlan(exe('/Volumes/Watchdown 1.2.1-arm64'), HOME)).toEqual({
      bundle: '/Volumes/Watchdown 1.2.1-arm64/Watchdown.app',
      target: '/Users/ada/Applications/Watchdown.app',
    });
  });

  it('installs a translocated copy', () => {
    const dir = '/private/var/folders/ab/T/AppTranslocation/1234-ABCD/d';
    expect(userInstallPlan(exe(dir), HOME)?.bundle).toBe(`${dir}/Watchdown.app`);
  });

  it('leaves a copy already in ~/Applications alone', () => {
    expect(userInstallPlan(exe('/Users/ada/Applications'), HOME)).toBeNull();
  });

  it('leaves a copy an admin put in /Applications alone', () => {
    expect(userInstallPlan(exe('/Applications'), HOME)).toBeNull();
    expect(userInstallPlan(exe('/Applications/Tools'), HOME)).toBeNull();
  });

  it('ignores a home folder with a trailing slash', () => {
    expect(userInstallPlan(exe('/Users/ada/Applications'), '/Users/ada/')).toBeNull();
  });

  it('returns null without a home folder or outside an app bundle', () => {
    expect(userInstallPlan(exe('/Volumes/Watchdown'), '')).toBeNull();
    expect(userInstallPlan('/usr/local/bin/watchdown', HOME)).toBeNull();
    expect(userInstallPlan('/x/Watchdown.app/Contents/Frameworks/Helper', HOME)).toBeNull();
  });
});
