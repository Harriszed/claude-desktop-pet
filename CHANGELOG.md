# Changelog

## 1.3.1

### Changed
- Replaced the flashing thinking gag with a subtler deep-thought animation and allowed its full 6.86-second loop to finish.

## 1.3.0

### Added
- Windows installer with desktop and Start menu shortcuts; Node.js and Git are no longer needed for packaged installs.
- macOS universal DMG/ZIP and Linux AppImage/Debian build targets.
- One Settings window for size, visibility, weather, chatter, sound and startup. Right-click the pet or use the tray menu to open it.
- Connect, repair and disconnect Claude Code hooks from Settings, using the bundled runtime.
- Optional completion chime with volume and preview; off by default.
- Native login startup on macOS and XDG autostart on Linux.
- Fullscreen detection and session focus on macOS and Linux X11, with explicit permission and Wayland limitations.
- In-app update downloads and restart-to-install for Windows installers and Linux AppImages.
- Automated builds and GitHub Releases with installers, update metadata and illustrated release notes.

### Changed
- Tray menu is shorter; preferences live in Settings.
- Electron updated to 44; source installs now require Node.js 22.12+.
- README now leads with downloadable apps, platform notes and update instructions.

### Fixed
- Connections preserve unrelated hooks and existing status lines, prevent duplicate listeners and migrate old pet hooks.
- Failed update checks no longer report that you are up to date.
- Source and packaged apps use the same preference location.


## 1.2.0

### Added
- **Check for updates** in the tray menu, plus an automatic daily check that tells you when a new version is out.

## 1.1.0

### Added
- **Always on top** option in the tray menu (on by default). The pet also re-raises itself every few seconds so other windows can't bury it.
- **Resize:** click the faint arrow in the top-right corner to cycle between large, medium and small. The size is remembered.
- **Start Pet.vbs:** double-click to launch the pet with no command window.
- **Promo video** and animated preview on the README.
- Updated coffee gag animation.

### Changed
- Card now has a raised, 3D look.
- The scene has a subtle recessed inner shadow, like looking into a box.
- README now explains running the pet with `Start Pet.vbs` instead of `npm start`.

### Fixed
- **Start with Windows** now works when the install folder has spaces in its name. Existing startup entries are repaired automatically; if you had turned it off, it stays off.

## 1.0.0
- First release.
