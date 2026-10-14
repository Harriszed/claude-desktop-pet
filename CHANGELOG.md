# Changelog

## 1.4.0 — 2026-10-14

### Changed
- Replaced sleeping with Mascot Studio v1.7.2's blue nightcap, gentle bob and drifting Zs.
- Automatic gags have a 35% chance on each eligible check, down from 50%. Breathing and looking around each have a higher idle-selection weight than stretching, while immediate repeats remain excluded.

### Fixed
- Restored the walking animation from before the v1.7.0 artwork update.
- Delegation uses the full-size Claude with shades and task cards, avoiding extra miniature Claudes in the main scene. Actual sub-agents remain in their own row.
- Cloud drift and star twinkles keep their animation timelines when the background refreshes. Hiding the pet pauses cloud movement instead of resetting it.
- Windows click targets no longer become native window-drag regions. Session chips, mascot details, helpers, laptops and resize remain clickable; drag using the header or footer.

### Added
- Three idle animations—stretching, looking around and a quiet breath—cycle randomly without immediate repeats. Each finishes one or two loops; walking, greetings, gags and live work interrupt them. Rotation pauses when hidden or reduced motion is enabled.
- Refreshed activities and all ten gags from Mascot Studio v1.7.0, including weighted hammering and shades/task-card delegation. Walking stays on v1.6.0; sleeping uses v1.7.2. Imported artwork and timing are unchanged, with two locally authored idle variants.
- Settings can refresh the 5h and 7d usage figures every 1, 5 or 15 minutes, or every hour. The choice saves automatically and takes effect without restarting; the default is 5 minutes.
- Animation timing now comes from a pinned catalog; gags, boot greetings and helper poses can finish their new sequences.
- Test connection in Settings runs the configured pet hook and verifies that its test message reaches the app, without creating fake sessions or changing existing hooks.
- A direct Settings update flow: check, download with progress, then restart to replace the installed app and reopen it. Failed downloads and installer starts can be retried.
- Visual effects controls for the existing fireflies and completion sparkles, plus twinkling stars, shooting stars, drifting clouds, dust, autumn leaves, work sparks and optional retro scanlines.
- A wake-up sequence with a wave and bow, startup toggle and preview. Incoming activity interrupts it.
- Effects intensity, immediate preference saving, reduced-motion support and hidden-window pausing.
- New screenshots and a recording of the current app, plus Windows packaged checks in the three-platform release workflow.

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
