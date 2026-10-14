# Claude Desktop Pet 1.4.0

A visual refresh for your desktop companion, with new activity stories, calmer idle behaviour, configurable scene effects and easier updating.

![Current pet with helpers and task progress](https://raw.githubusercontent.com/Harriszed/claude-desktop-pet/v1.4.0/docs/hero.png)

## What's new

- Refreshed activity animations and ten extended gags, including weighted hammering and Claude in shades directing task cards. Real sub-agents stay in their own row.
- Three random idle animations: stretching, looking around and breathing. The quiet choices are favoured, immediate repeats are blocked, and gags appear less often.
- Blue-nightcap sleeping from Mascot Studio v1.7.2, with a gentle bob and drifting Zs. The earlier walking animation is restored.
- Settings controls for fireflies, stars, clouds, dust, leaves, work sparks, completion sparkles, optional scanlines, intensity and a boot sequence. Effects respect reduced motion and pause while hidden.
- **Test connection** checks that the Claude Code hook reaches your pet and offers repair steps when needed.
- **Usage refresh** offers 1, 5 or 15 minutes, or 1 hour for both the 5h and 7d figures.
- Windows and AppImage updates now have a clear Settings flow: check, download with progress, then restart and install.

Session chips, mascot and sub-agent details, laptops and the resize arrow are clickable again in Windows builds. Clouds and stars keep their animation timelines when the background refreshes.

![Night effects and active helpers](https://raw.githubusercontent.com/Harriszed/claude-desktop-pet/v1.4.0/docs/night.png)

## Downloads

| Your computer | Download |
|---|---|
| Windows 10/11, x64 | [Windows installer](https://github.com/Harriszed/claude-desktop-pet/releases/download/v1.4.0/Claude-Desktop-Pet-1.4.0-Setup-x64.exe) |
| macOS, Intel or Apple Silicon | [Universal DMG](https://github.com/Harriszed/claude-desktop-pet/releases/download/v1.4.0/Claude-Desktop-Pet-1.4.0-mac-universal.dmg) |
| Linux x64 | [AppImage](https://github.com/Harriszed/claude-desktop-pet/releases/download/v1.4.0/Claude-Desktop-Pet-1.4.0-linux-x86_64.AppImage) or [Debian package](https://github.com/Harriszed/claude-desktop-pet/releases/download/v1.4.0/Claude-Desktop-Pet-1.4.0-linux-amd64.deb) |

## Updating

Choose **Check for updates** in Settings or the tray menu. Windows installer and Linux AppImage users can download inside the app, then choose **Restart and install**. macOS and Debian users replace their app or install the new package. Preferences are kept.

Source users: quit the pet, run `git pull` and `npm install`, then relaunch.

![Current Settings](https://raw.githubusercontent.com/Harriszed/claude-desktop-pet/v1.4.0/docs/settings.png)

Windows app flows are tested locally and in the release workflow. All three platforms run unit tests and build on their native GitHub runners; macOS and Linux desktop behaviour has not been manually verified for this release. These community builds remain unsigned. See the [setup and platform notes](https://github.com/Harriszed/claude-desktop-pet/tree/v1.4.0#install) and [full changelog](https://github.com/Harriszed/claude-desktop-pet/blob/v1.4.0/CHANGELOG.md).

Screenshots and the README recording use fictional demo sessions and example usage figures.
