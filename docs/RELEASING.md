# Build and release

The project packages with electron-builder. Use Node.js 22.12+ on each target platform.

```bash
npm ci
npm test
npm run dist:win
```

Use `dist:mac` on macOS for a universal DMG and ZIP, or `dist:linux` on Linux for an x64 AppImage and Debian package. Windows installers are per-user, include shortcuts, and preserve preferences on uninstall. Packaged hooks run with the bundled Electron runtime in Node mode; do not disable the RunAsNode fuse unless you also replace that hook runner.

For a local unpacked build, use `npm run pack`. Windows can verify the app with `npm run test:smoke` and, after building, `npm run test:packaged`. Smoke checks use temporary preferences, a temporary Claude settings file, and a separate hook port. They never change the real Claude connection or login entry.

## GitHub Releases

1. Update the version in `package.json` and run `npm install --package-lock-only`.
2. Update `CHANGELOG.md` and `docs/RELEASE_NOTES.md`, including asset names and screenshot links.
3. Run tests and inspect the Settings screenshot. Commit the app, docs and lockfile.
4. Tag that exact commit and push it:

```bash
git tag v1.3.0
git push origin main
git push origin v1.3.0
```

The **Build and release** workflow runs unit tests and builds on Windows, macOS and Ubuntu. Only after every build succeeds does it upload installers, blockmaps and update YAML files, then publish the Release with illustrated notes. Manual workflow runs build downloadable Actions artifacts without publishing. Do not retarget an existing release tag; use a new version for fixes.

Keep `latest.yml`, `latest-linux.yml` and referenced files together: installed copies use them to find and verify updates. The local `dist/` folder is ignored by Git. CI publishes with the repository-scoped `GITHUB_TOKEN`; no personal token is committed.

## Signing

Current builds are unsigned. Windows disables executable signing but keeps the app icon and version metadata. To ship signed builds, configure `CSC_LINK` and `CSC_KEY_PASSWORD`, remove `win.signExecutable: false`, and pass the secrets into the build job. Follow [electron-builder’s signing documentation](https://www.electron.build/code-signing/).

macOS builds use a universal binary and currently open release downloads for updates. For Developer ID signing/notarisation, provide the signing certificate and Apple notarisation credentials as CI secrets, replace `CSC_IDENTITY_AUTO_DISCOVERY: false` with the signing configuration, then verify Gatekeeper on a clean Mac. See [macOS signing](https://www.electron.build/code-signing-mac/). Only enable automatic macOS updates after signed builds have been verified; the current release-download fallback intentionally works for unsigned distributions.

## Native acceptance checks

Before describing a platform as fully tested, check first-launch connection, completion events, volume, corner positioning, fullscreen restore, restart persistence, start-at-login, disconnect and uninstall on a real desktop. On macOS grant Accessibility/Automation; on X11 test with and without `xprop`/`wmctrl`; on Wayland verify disabled controls and the explanatory message. CI compilation and unit tests do not substitute for those desktop checks.
