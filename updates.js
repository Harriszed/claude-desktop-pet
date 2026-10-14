const REPO = 'Harriszed/claude-desktop-pet'
const RELEASES = `https://github.com/${REPO}/releases/latest`
const numbers = value => String(value).replace(/^v/, '').split('.').map(Number)
const isNewer = (a, b) => {
  const x = numbers(a), y = numbers(b)
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i]
  return false
}

function createUpdates({ app, dialog, shell, loadSettings, saveSettings, onChange = () => {}, platform = process.platform, env = process.env, fetcher = fetch, updater }) {
  const automaticInstall = app.isPackaged && (platform === 'win32' || (platform === 'linux' && !!env.APPIMAGE))
  let busy = false
  const hint = automaticInstall ? 'Checks once a day. Updates download here and replace the app when you choose Restart and install.' : app.isPackaged ? 'Checks once a day. Download a new release to replace this app.' : 'Running from source. Quit the pet, run git pull and npm install, then relaunch. Install the Windows Setup.exe for in-app updates.'
  let state = { phase: 'idle', message: hint, automaticInstall }
  const emit = patch => { state = { ...state, ...patch }; onChange(state) }
  if (automaticInstall) {
    updater.autoDownload = false
    updater.autoInstallOnAppQuit = false
    updater.on('error', () => emit({ phase: state.phase === 'installing' ? 'downloaded' : 'error', message: 'Could not update. Try again or download the latest release.' }))
    updater.on('download-progress', p => emit({ phase: 'downloading', message: `Downloading update… ${Math.round(p.percent)}%` }))
  }
  const install = () => {
    if (!automaticInstall || busy || state.phase !== 'downloaded') return state
    emit({ phase: 'installing', message: 'Installing update. The pet will restart with your settings kept.' })
    try { updater.quitAndInstall(true, true) }
    catch { emit({ phase: 'downloaded', message: 'Could not start the installer. Choose Restart and install to try again.' }) }
    return state
  }
  async function performDownload(promptRestart) {
    emit({ phase: 'downloading', message: 'Downloading update…' })
    await updater.downloadUpdate()
    emit({ phase: 'downloaded', message: 'Update ready. Choose Restart and install to replace the app and reopen it. Your settings will be kept.' })
    if (promptRestart) {
      const restart = await dialog.showMessageBox({ type: 'info', title: 'Claude Desktop Pet', message: 'Your update is ready', buttons: ['Restart and install', 'Later'], defaultId: 0, cancelId: 1 })
      if (restart.response === 0) { busy = false; install() }
    }
  }
  async function download() {
    if (!automaticInstall || busy || state.phase !== 'available') return state
    busy = true
    try { await performDownload(false) }
    catch { emit({ phase: 'available', message: 'Could not download the update. Choose Download update to try again, or use Downloads & release notes.' }) }
    finally { busy = false }
    return state
  }
  async function check(manual = false, { inline = false } = {}) {
    if (busy) return state
    if (state.phase === 'downloaded') {
      if (manual && !inline) {
        const answer = await dialog.showMessageBox({ type: 'info', title: 'Claude Desktop Pet', message: 'Your update is ready', buttons: ['Restart and install', 'Later'], defaultId: 0, cancelId: 1 })
        if (answer.response === 0) install()
      }
      return state
    }
    busy = true
    emit({ phase: 'checking', message: 'Checking for updates…' })
    try {
      let latest
      if (automaticInstall) {
        latest = (await updater.checkForUpdates())?.updateInfo?.version
      } else {
        const endpoint = app.isPackaged ? 'releases' : 'tags'
        const response = await fetcher(`https://api.github.com/repos/${REPO}/${endpoint}?per_page=100`, { signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'claude-desktop-pet' } })
        if (!response.ok) throw new Error('GitHub unavailable')
        const data = await response.json()
        if (!Array.isArray(data)) throw new Error('Invalid release response')
        latest = data.filter(item => !item.draft && !item.prerelease).map(item => item.tag_name || item.name).filter(v => /^v?\d+\.\d+\.\d+$/.test(v)).sort((a, b) => isNewer(a, b) ? -1 : isNewer(b, a) ? 1 : 0)[0]
      }
      if (!latest) throw new Error('No published version found')
      saveSettings({ updateCheckedAt: Date.now() })
      if (!isNewer(latest, app.getVersion())) {
        emit({ phase: 'current', message: `You’re up to date (${app.getVersion()}).` })
        if (manual && !inline) await dialog.showMessageBox({ type: 'info', title: 'Claude Desktop Pet', message: state.message })
        return state
      }
      emit({ phase: 'available', message: `Version ${latest.replace(/^v/, '')} is available.` })
      if (inline) return state
      const detail = automaticInstall ? 'Download the update now, then choose when to restart. Your settings will be kept.' : app.isPackaged ? 'Download the latest release and replace your installed app. Your settings will be kept.' : 'In the pet folder, run git pull, then npm install. Quit and relaunch the pet afterward.'
      const action = automaticInstall ? 'Download update' : app.isPackaged ? 'Download release' : 'See what’s new'
      const choice = await dialog.showMessageBox({ type: 'info', title: 'Claude Desktop Pet', message: state.message, detail, buttons: [action, 'Later'], defaultId: 0, cancelId: 1 })
      if (choice.response === 0) {
        if (automaticInstall) {
          await performDownload(true)
        } else await shell.openExternal(app.isPackaged ? RELEASES : `https://github.com/${REPO}/blob/main/CHANGELOG.md`)
      }
    } catch {
      emit({ phase: 'error', message: 'Could not check for updates. Check your connection or download the latest release.' })
      if (manual && !inline) await dialog.showMessageBox({ type: 'warning', title: 'Claude Desktop Pet', message: 'Couldn’t check for updates', detail: 'Check your internet connection and try again. You can also download from GitHub Releases.' })
    } finally { busy = false }
    return state
  }
  async function settingsAction() {
    if (busy || state.phase === 'installing') return state
    if (state.phase === 'downloaded') return install()
    if (state.phase === 'available') {
      if (automaticInstall) return download()
      await shell.openExternal(RELEASES)
      return state
    }
    return check(true, { inline: true })
  }
  return { check, download, settingsAction, status: () => state, install, automaticInstall }
}

module.exports = { createUpdates, isNewer, REPO, RELEASES }
