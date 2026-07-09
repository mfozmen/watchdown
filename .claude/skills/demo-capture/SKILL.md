---
name: demo-capture
description: >
  How to capture the real running Watchdown window on Windows for screenshots and
  demo GIFs (README hero, release assets), and how to script a live-external-edit-sync
  GIF. Covers the capture method that actually works (PrintWindow + PW_RENDERFULLCONTENT
  + SetProcessDPIAware), why capturePage and plain screen-grabs fail, and the ImageMagick
  assembly recipe. Use whenever producing a screenshot/GIF of the app, or when a capture
  comes out blank, half-cropped, frameless, or from the wrong desktop.
---

# Capturing the Watchdown window for demos (Windows)

Distilled from actually doing it. Follow this instead of re-deriving; the failure modes below
each cost a wasted attempt.

## Environment reality (don't assume isolation)

The agent's PowerShell runs in the **user's active console session** (e.g. `SessionId 3`, the
`console` session). It **can see and capture the user's app windows** — verify with
`Get-Process | Where MainWindowHandle -ne 0` (you'll see VS Code, Chrome, etc.). Do **not** assume
"different session / can't capture." If a capture is blank, the cause is the *method* (below), not
isolation. If the app window handle isn't found, the app simply isn't running — launch it.

## The method that works

Capture the window directly with `PrintWindow(hwnd, hdc, 2)` where `2` = **PW_RENDERFULLCONTENT**
(captures DWM/GPU-composited content — Electron renders via GPU, so plain `PrintWindow(…,0)` and
GDI grabs come back **blank/white**). Make the process **DPI-aware first** or `GetWindowRect`
returns a scaled-down size, the bitmap is too small, and the window is captured **half-cropped**
(right/bottom cut off). Dual monitors are irrelevant — `PrintWindow` captures the window, not a
screen region.

```powershell
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System; using System.Runtime.InteropServices;
public class Cap {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr hdc, uint flags);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out R rc);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [StructLayout(LayoutKind.Sequential)] public struct R { public int L,T,Rr,B; }
}
"@
[void][Cap]::SetProcessDPIAware()                     # BEFORE GetWindowRect, or you get a half crop
$h = (Get-Process Watchdown | ? { $_.MainWindowHandle -ne 0 } | select -First 1).MainWindowHandle
[void][Cap]::SetForegroundWindow($h); Start-Sleep -Milliseconds 600
$rc = New-Object Cap+R; [void][Cap]::GetWindowRect($h,[ref]$rc)
$w=$rc.Rr-$rc.L; $ht=$rc.B-$rc.T
$bmp = New-Object System.Drawing.Bitmap $w,$ht
$g = [System.Drawing.Graphics]::FromImage($bmp); $hdc = $g.GetHdc()
[void][Cap]::PrintWindow($h,$hdc,2); $g.ReleaseHdc($hdc); $g.Dispose()
$bmp.Save("$env:USERPROFILE\Desktop\shot.png",[System.Drawing.Imaging.ImageFormat]::Png)
```

The result includes the **real window chrome** (title bar with the W↓ icon, menu, min/max/close) —
no synthetic frame needed. (`capturePage` on a `BrowserWindow` grabs renderer content only, so it
looks frameless — that's what the old, frameless demo GIF was.)

## Scripted live-sync demo GIF

The app syncs on disk changes, so drive the demo by editing the file and capturing between edits:

1. Set the theme up front (installed app reads it on start): write `~/.watchdown/preferences.json`
   = `{"theme":"dark"}` (UTF-8, no BOM), then launch the installed
   `%LOCALAPPDATA%\Programs\Watchdown\Watchdown.exe` with a demo `.md` and `--author "Claude Code"`.
   `Stop-Process` any old instance first so it picks up the new theme.
2. Loop: write/`AppendAllText` an external edit → `Start-Sleep ~750ms` (settle + render, presence
   badge shows) → `Grab` a frame. Capture 1–2 base frames first and 1–2 settled frames last.
3. Assemble + optimize with ImageMagick:

```bash
magick -delay 85 -loop 0 frames/*.png -resize 820x raw.gif
magick raw.gif -coalesce +repage -layers optimize final.gif   # ~150–200 KB
```

Gotcha: running `-layers optimize` directly on the raw PNGs **collapses the canvas** (produces a
tiny broken GIF). Assemble to a GIF first, then `-coalesce +repage -layers optimize` — verify with
`magick final.gif -coalesce out/%03d.png` that every frame is full-size.

## Showing it to the user

The scratchpad is a Temp path the user can't find. **Copy the GIF/PNG to their Desktop**
(`$env:USERPROFILE\Desktop\…`) and give that name. Visual artifacts still need their approval before
merging.

## Checklist

- [ ] `SetProcessDPIAware()` called before `GetWindowRect` (else half-cropped).
- [ ] `PrintWindow` flag `2` (PW_RENDERFULLCONTENT) — not `0` (blank on GPU content).
- [ ] Verified the capture isn't blank/white by viewing it (light theme is legitimately white — don't confuse it with a blank grab).
- [ ] GIF assembled then optimized (`-coalesce +repage -layers optimize`), frames verified full-size.
- [ ] Copied to the user's Desktop; got approval before committing.
