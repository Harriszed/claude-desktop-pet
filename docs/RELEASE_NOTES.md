# Claude Desktop Pet 1.3.0

Install your companion without Node.js or a terminal, then make it your own from the new Settings window.

![Claude Desktop Pet in action](https://raw.githubusercontent.com/Harriszed/claude-desktop-pet/v1.3.0/docs/promo.gif)

## Downloads

| Your computer | Asset |
|---|---|
| Windows 10/11, x64 | `Claude-Desktop-Pet-1.3.0-Setup-x64.exe` |
| macOS, Intel or Apple Silicon | `Claude-Desktop-Pet-1.3.0-mac-universal.dmg` |
| Linux x64 | `Claude-Desktop-Pet-1.3.0-linux-x64.AppImage` or `.deb` |

Open the app, choose **Settings → Connect Claude Code**, and restart your Claude Code sessions. Your existing hooks and custom status line are preserved.

## What’s new

- **One place for preferences.** Size, compact mode, always on top, fullscreen hiding, weather, chatter, startup and sound now live in Settings. Open it from the tray or by right-clicking the pet.
- **A quiet completion chime.** Optional, off by default, with a volume control and Test chime button.
- **Easier updates.** Windows installers and Linux AppImages can download an update inside the app and install it when you choose to restart. macOS and Debian installs open the latest download instead.
- **More desktops.** macOS and Linux startup support, plus fullscreen detection and session focus on macOS and Linux X11.
- **Safer connections.** Backups, repair and disconnect controls; reconnecting avoids duplicate pet hooks.
- **Updated runtime.** Electron 44; source installs now need Node.js 22.12 or later.

![New Settings window](https://raw.githubusercontent.com/Harriszed/claude-desktop-pet/v1.3.0/docs/settings.png)

## Existing users

Quit the old pet before running the new one. Your saved preferences stay in the same place. Choose **Repair connection** after switching from a source install to a packaged app, then restart your Claude Code sessions.

Source installs still update with `git pull` and `npm install`; quit before running npm on Windows.

## Platform details

These community builds are unsigned. Windows may show SmartScreen; macOS may need **Privacy & Security → Open Anyway**. Managed Macs may block unsigned apps. macOS fullscreen detection and session focus can require Accessibility and Automation access. Linux X11 uses `xprop` and `wmctrl`; Wayland restricts fullscreen detection and session focus. AppImages may require FUSE compatibility packages.

See the [setup guide](https://github.com/Harriszed/claude-desktop-pet/tree/v1.3.0#install) and [full changelog](https://github.com/Harriszed/claude-desktop-pet/blob/v1.3.0/CHANGELOG.md).
