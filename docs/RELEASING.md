# Build and release

The project packages with electron-builder. Use Node.js 22.12+ on each target platform.

```bash
npm ci
npm test
npm run dist:win
```

Use `dist:mac` on macOS for a universal DMG and ZIP, or `dist:linux` on Linux for an x64 AppImage and Debian package. Windows installers are per-user, include shortcuts, and preserve preferences on uninstall. Packaged hooks run with the bundled Electron runtime in Node mode; do not disable the RunAsNode fuse unless you also replace that hook runner.

For a local unpacked build, use `npm run pack`. Windows can verify the app with `npm run test:smoke` and, after building, `npm run test:packaged`. Smoke checks use temporary preferences, a temporary Claude settings file, and a separate hook port. They never change the real Claude connection or login entry.

Run `npm run test:vfx` for visual effects, boot interruption, reduced motion, window hiding and preference persistence. After packaging, run `node scripts/vfx-smoke-test.js --packaged` to verify the bundled effects and styles too.

After `npm run dist:win`, run `npm run test:update` to exercise the Settings button with a real installer served from a temporary local update feed. It verifies the downloaded binary and restart request, intercepting installer launch so it never replaces your installed app. The update cache and preferences stay in a temporary directory.

Run `npm run test:interaction` and `node scripts/interaction-smoke-test.js --packaged` on Windows for native hit-testing of drag and click regions, plus session selection, mascot/helper details, laptops and resizing. Browser mouse events alone can miss native drag-region regressions.

Run `npm run test:backdrop` and `node scripts/backdrop-smoke-test.js --packaged` to verify cloud positions and cloud/star animation identity survive background refreshes, weather updates and window hiding.

Animations are imported from a pinned Mascot Studio tag with `node scripts/sync-animations.js <mascot-studio-checkout> v1.7.0`. The import preserves 30 source SVGs byte for byte, restores walking from v1.6.0, imports sleeping from v1.7.2, maps activity IDs onto the app's existing states, refreshes gag GIFs, and generates the shared timing catalog. It then builds two local idle stories from `scripts/build-idle-animations.mjs` using the pinned actor and compiler. Run that script with the checkout path to rebuild just those idles. Both commands read Git blobs without changing the source checkout. Run `npm run test:animations` for pose boundaries, complete loops, one-shot completion, reduced motion, full-size delegation and app loading; it also writes preview sheets to `output/animations/`. Run `npm run test:idle` for random idle playback, the earlier walk, live interruption and reduced-motion behavior in the real app. After packaging, use `node scripts/animation-smoke-test.js --packaged` and `node scripts/idle-smoke-test.js --packaged` to check the bundled images and behavior.

## GitHub Releases

1. Update the version in `package.json` and run `npm install --package-lock-only`.
2. Update `CHANGELOG.md` and `docs/RELEASE_NOTES.md`, including asset names and screenshot links.
3. Run tests and inspect the Settings screenshot. Commit the app, docs and lockfile.
4. Tag that exact commit and push it:

```bash
git tag v1.4.0
git push origin main
git push origin v1.4.0
```

The **Build and release** workflow runs unit tests and builds on Windows, macOS and Ubuntu. Windows also runs packaged settings, animation, idle, backdrop and update checks. Only after every job succeeds does it publish installers, blockmaps and update YAML files in a Release with illustrated notes. Manual workflow runs build downloadable Actions artifacts without publishing. Do not retarget an existing release tag; use a new version for fixes.

Run `node scripts/capture-release-media.js` on Windows to refresh day/night, helpers, sleeping and weather screenshots plus the short real-app recording. It uses temporary preferences and fictional sessions; FFmpeg must be on PATH. Refresh Settings with `npm run test:smoke`, copying `output/playwright/settings.png` to `docs/settings.png`. Keep illustration captions clear about demo data.

Keep `latest.yml`, `latest-linux.yml` and referenced files together: installed copies use them to find and verify updates. The local `dist/` folder is ignored by Git. CI publishes with the repository-scoped `GITHUB_TOKEN`; no personal token is committed.

## Signing

Current builds are unsigned. Windows disables executable signing but keeps the app icon and version metadata. To ship signed builds, configure `CSC_LINK` and `CSC_KEY_PASSWORD`, remove `win.signExecutable: false`, and pass the secrets into the build job. Follow [electron-builder’s signing documentation](https://www.electron.build/code-signing/).

macOS builds use a universal binary and currently open release downloads for updates. For Developer ID signing/notarisation, provide the signing certificate and Apple notarisation credentials as CI secrets, replace `CSC_IDENTITY_AUTO_DISCOVERY: false` with the signing configuration, then verify Gatekeeper on a clean Mac. See [macOS signing](https://www.electron.build/code-signing-mac/). Only enable automatic macOS updates after signed builds have been verified; the current release-download fallback intentionally works for unsigned distributions.

## Native acceptance checks

Before describing a platform as fully tested, check first-launch connection, completion events, volume, corner positioning, fullscreen restore, restart persistence, start-at-login, disconnect and uninstall on a real desktop. On macOS grant Accessibility/Automation; on X11 test with and without `xprop`/`wmctrl`; on Wayland verify disabled controls and the explanatory message. CI compilation and unit tests do not substitute for those desktop checks.
