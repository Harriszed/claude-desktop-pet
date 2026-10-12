const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFile } = require('child_process')

const run = (file, args) => new Promise((resolve, reject) => execFile(file, args, { timeout: 5000, windowsHide: true }, (err, stdout) => err ? reject(err) : resolve(stdout.trim())))
const desktopQuote = value => `"${String(value).replace(/([\\"`$])/g, '\\$1')}"`
const desktopValue = value => String(value).replace(/%/g, '%%')

function createStartup(app, { platform = process.platform, env = process.env, home = os.homedir(), executable = process.execPath, appPath = __dirname } = {}) {
  const launch = platform === 'linux' && env.APPIMAGE ? env.APPIMAGE : executable
  const args = app.isPackaged ? [] : [appPath]
  const options = platform === 'win32' ? { path: `"${launch}"`, args: args.map(v => `"${v}"`) } : { path: launch, args }
  const desktopFile = path.join(env.XDG_CONFIG_HOME || path.join(home, '.config'), 'autostart', 'claude-desktop-pet.desktop')
  const enabled = () => platform === 'linux' ? fs.existsSync(desktopFile) && !/^Hidden=true$/m.test(fs.readFileSync(desktopFile, 'utf8')) : app.getLoginItemSettings(options).openAtLogin
  const set = on => {
    if (platform !== 'linux') { app.setLoginItemSettings({ openAtLogin: on, ...options }); return }
    if (on) {
      fs.mkdirSync(path.dirname(desktopFile), { recursive: true })
      const exec = [launch, ...args].map(v => desktopQuote(desktopValue(v))).join(' ')
      fs.writeFileSync(desktopFile, `[Desktop Entry]\nType=Application\nName=Claude Desktop Pet\nExec=${exec}\nTerminal=false\nX-GNOME-Autostart-enabled=true\n`)
    } else if (fs.existsSync(desktopFile)) fs.unlinkSync(desktopFile)
  }
  const repair = () => {
    if (platform !== 'win32' || app.isPackaged || enabled()) return
    const legacy = app.getLoginItemSettings({ path: executable, args: [appPath] })
    if (legacy.openAtLogin && (legacy.launchItems || []).some(item => item.enabled)) set(true)
  }
  return { enabled, set, repair }
}

async function capabilities() {
  if (process.platform === 'win32') return { fullscreen: true, focus: true, note: '' }
  if (process.platform === 'darwin') return { fullscreen: true, focus: true, note: 'macOS may ask for Accessibility and Automation access to detect fullscreen apps and focus sessions.' }
  if (process.env.XDG_SESSION_TYPE === 'wayland' || process.env.WAYLAND_DISPLAY) return { fullscreen: false, focus: false, note: 'Wayland restricts fullscreen detection and session focus. The pet and other preferences still work.' }
  const available = await Promise.allSettled([run('xprop', ['-root', '_NET_ACTIVE_WINDOW']), run('wmctrl', ['-lp'])])
  return { fullscreen: available[0].status === 'fulfilled', focus: available[1].status === 'fulfilled', note: 'On Linux X11, fullscreen detection uses xprop and session focus uses wmctrl. Install them with your distribution’s package manager if needed.' }
}

async function foregroundFullscreen() {
  if (process.platform === 'darwin') {
    return (await run('osascript', ['-e', 'tell application "System Events" to tell first application process whose frontmost is true\nif unix id is ' + process.pid + ' then return false\ntry\nreturn value of attribute "AXFullScreen" of front window\non error\nreturn false\nend try\nend tell'])) === 'true'
  }
  const active = await run('xprop', ['-root', '_NET_ACTIVE_WINDOW'])
  const id = active.match(/0x[0-9a-f]+/i)?.[0]
  if (!id || id === '0x0') return false
  const props = await run('xprop', ['-id', id, '_NET_WM_STATE', '_NET_WM_PID'])
  if (Number(props.match(/_NET_WM_PID\([^)]*\)\s*=\s*(\d+)/)?.[1]) === process.pid) return false
  return props.includes('_NET_WM_STATE_FULLSCREEN')
}

async function focusSession(pid) {
  if (!Number.isInteger(pid) || pid < 1) return false
  const windows = process.platform === 'linux' ? (await run('wmctrl', ['-lp'])).split('\n') : []
  for (let i = 0; i < 12 && pid > 1; i++) {
    if (process.platform === 'darwin') {
      const found = await run('osascript', ['-e', `tell application "System Events"\nset targets to application processes whose unix id is ${pid}\nif (count targets) > 0 then\nset frontmost of item 1 of targets to true\nreturn true\nend if\nreturn false\nend tell`])
      if (found === 'true') return true
    } else {
      const row = windows.find(line => Number(line.trim().split(/\s+/)[2]) === pid)
      if (row) { await run('wmctrl', ['-ia', row.trim().split(/\s+/)[0]]); return true }
    }
    pid = Number(await run('ps', ['-o', 'ppid=', '-p', String(pid)]))
  }
  return false
}

module.exports = { createStartup, capabilities, foregroundFullscreen, focusSession, desktopQuote }
