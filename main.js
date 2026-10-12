const { app, BrowserWindow, Tray, Menu, nativeImage, screen, ipcMain } = require('electron')
const http = require('http')
const path = require('path')
const os = require('os')
const { spawn } = require('child_process')
const fs = require('fs')

const CRLF = String.fromCharCode(13, 10)
const PORT = 47821
const WIN_W = 340
const WIN_H = 176
const UG_H = 84
const COMPACT_H = 40
const TOOL_HOLD_MS = 2500
const ERROR_HOLD_MS = 4000
const DONE_MS = 5000
const GREETING_MS = 6000
const SLEEP_MS = 10 * 60 * 1000
const STALE_BUSY_MS = 5 * 60 * 1000
const STALE_AGENT_MS = 3 * 60 * 1000
const COMPACT_MAX_MS = 60000
const MIN_SCENE_MS = 2000
const CTX_WARN = 85
const URGENT = new Set(['waiting-for-you', 'error', 'done'])
const PREVIEWS = ['idle', 'thinking', 'using-tool', 'directing-helpers', 'done', 'greeting', 'asleep', 'reading', 'writing', 'running-commands', 'searching-web', 'searching-code', 'testing', 'committing', 'waiting-for-you', 'error', 'compacting', 'context-nearly-full', 'plan-progress', 'server-running', 'typing']

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) app.exit(0)

let win, tray
const sessions = new Map()
let lastEventAt = Date.now()
let current = { state: 'idle', project: '' }
let sceneStartedAt = 0
let preview = null

const toolState = (tool, command) => {
  if (tool === 'Read') return 'reading'
  if (['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(tool)) return 'writing'
  if (tool === 'WebSearch' || tool === 'WebFetch') return 'searching-web'
  if (tool === 'Grep' || tool === 'Glob') return 'searching-code'
  if (tool === 'Task' || tool === 'Agent') return 'directing-helpers'
  if (tool === 'TodoWrite' || tool.startsWith('Task')) return 'plan-progress'
  if (tool === 'Bash') {
    if (/\bgit\s+(commit|push)\b/.test(command)) return 'committing'
    if (/\b(test|jest|vitest|pytest|playwright|mocha)\b/.test(command)) return 'testing'
    if (/\b(run dev|npm start|expo start|vite|http-server|serve)\b/.test(command)) return 'server-running'
    return 'running-commands'
  }
  return 'using-tool'
}

const session = id => {
  if (!sessions.has(id)) sessions.set(id, { busy: false, busySince: 0, toolName: '', detail: '', todos: [], todosAt: 0, waiting: false, compactingAt: 0, errorUntil: 0, doneUntil: 0, greetUntil: 0, helpers: 0, spawns: 0, agents: new Map(), running: 0, tool: '', toolUntil: 0, last: Date.now(), cwd: '', errText: '', ppid: 0, ctx: 0 })
  return sessions.get(id)
}

const VERB = { Read: 'Reading', Edit: 'Editing', MultiEdit: 'Editing', NotebookEdit: 'Editing', Write: 'Writing', Grep: 'Searching', Glob: 'Finding', WebSearch: 'Searching web:', WebFetch: 'Fetching', Agent: 'Delegating:', Task: 'Delegating:', Bash: '$' }
const actionOf = s => {
  if (!s.toolName) return ''
  if (s.toolName === 'TodoWrite' || s.toolName.startsWith('Task') && s.toolName !== 'Task') return 'Updating the plan'
  const v = VERB[s.toolName]
  if (!v) return s.detail ? `${s.toolName}: ${s.detail}` : s.toolName
  return s.detail ? `${v} ${s.detail}` : v.replace(/:$/, '')
}
const taskEvent = (s, t, now) => {
  s.todosAt = now
  if (!t.id) { s.todos.push({ s: 'pending', c: t.subject || '' }); return }
  const k = parseInt(t.id, 10) - 1
  if (!s.todos[k]) return
  if (t.status === 'deleted') s.todos.splice(k, 1)
  else if (t.status) s.todos[k].s = t.status
}

const onAgentEvent = (s, e, now) => {
  if (e.event === 'SubagentStop') { s.agents.delete(e.agent); return }
  const a = s.agents.get(e.agent) ?? { tool: '', toolUntil: 0, running: 0, first: now }
  a.last = now
  if (e.event === 'PreToolUse') { a.running++; a.tool = toolState(e.tool, e.command); a.toolUntil = Infinity }
  else if (e.event === 'PostToolUse' || e.event === 'PostToolUseFailure') { a.running = Math.max(0, a.running - 1); a.toolUntil = now + TOOL_HOLD_MS }
  s.agents.set(e.agent, a)
}

const helperCount = s => s.agents.size + Math.max(0, s.spawns - s.agents.size)

const onEvent = e => {
  const now = Date.now()
  lastEventAt = now
  if (e.event === 'SessionEnd') { sessions.delete(e.session); return }
  const s = session(e.session)
  s.last = now
  if (e.cwd) s.cwd = e.cwd
  if (e.transcript) s.transcript = e.transcript
  s.id = e.session
  if (e.ppid) s.ppid = e.ppid
  if (e.agent) { onAgentEvent(s, e, now); return }
  if (e.event !== 'Notification') s.waiting = false
  if (e.event !== 'PreCompact') s.compactingAt = 0
  switch (e.event) {
    case 'SessionStart': s.greetUntil = e.source === 'startup' ? now + GREETING_MS : 0; break
    case 'UserPromptSubmit': s.busy = true; s.busySince = now; s.doneUntil = 0; break
    case 'PreToolUse':
      s.busy = true
      s.running++
      if (e.tool === 'Task' || e.tool === 'Agent') s.spawns++
      s.tool = toolState(e.tool, e.command)
      s.toolName = e.tool
      s.detail = e.detail || ''
      s.toolUntil = Infinity
      if (e.todos) { s.todos = e.todos.map(t => ({ s: t.s, c: t.c })); s.todosAt = now }
      if (e.task) taskEvent(s, e.task, now)
      break
    case 'PostToolUse':
    case 'PostToolUseFailure':
      s.running = Math.max(0, s.running - 1)
      if (e.tool === 'Task' || e.tool === 'Agent') s.spawns = Math.max(0, s.spawns - 1)
      s.toolUntil = now + TOOL_HOLD_MS
      if (e.event === 'PostToolUseFailure') { s.errorUntil = now + ERROR_HOLD_MS; s.errText = `Failed: ${e.detail || e.tool}`.slice(0, 70) }
      break
    case 'Stop': s.busy = false; s.running = 0; s.spawns = 0; s.agents.clear(); s.toolUntil = 0; s.doneUntil = now + DONE_MS; break
    case 'Notification': s.waiting = true; break
    case 'PreCompact': s.compactingAt = now; break
  }
}

const stateOf = now => {
  const list = [...sessions.values()]
  for (const s of list) if (s.busy && now - s.last > STALE_BUSY_MS) { s.busy = false; s.running = 0; s.spawns = 0 }
  for (const s of list) for (const [id, a] of s.agents) if (now - a.last > STALE_AGENT_MS) s.agents.delete(id)
  const any = fn => list.some(fn)
  if (any(s => s.waiting)) return 'waiting-for-you'
  if (any(s => now < s.errorUntil)) return 'error'
  if (any(s => s.compactingAt && now - s.compactingAt < COMPACT_MAX_MS)) return 'compacting'
  if (any(s => helperCount(s) > 0)) return 'directing-helpers'
  const tooling = list.find(s => s.tool && (s.running > 0 || now < s.toolUntil))
  if (tooling) return tooling.tool
  if (any(s => s.busy)) return any(s => s.busy && s.ctx >= CTX_WARN) ? 'context-nearly-full' : 'thinking'
  if (any(s => now < s.doneUntil)) return 'done'
  if (any(s => now < s.greetUntil)) return 'greeting'
  if (now - lastEventAt > SLEEP_MS) return 'asleep'
  return 'idle'
}

const projectOf = () => {
  const s = [...sessions.values()].sort((a, b) => b.last - a.last)[0]
  return s && s.cwd ? path.basename(s.cwd) : ''
}

const helpersNow = now => {
  const out = []
  for (const s of sessions.values()) {
    for (const [id, a] of s.agents) out.push({ id, state: a.tool && (a.running > 0 || now < a.toolUntil) ? a.tool : 'thinking' })
    for (let i = 0; i < s.spawns - s.agents.size; i++) out.push({ id: `p${out.length}`, state: 'greeting' })
  }
  return out.slice(0, 8)
}

const metaNow = now => {
  const list = [...sessions.values()]
  const tooling = list.find(s => s.toolName && (s.running > 0 || now < s.toolUntil))
  const lists = list.filter(s => s.todos.length && now - s.last < 30 * 60 * 1000 && (s.todos.some(t => t.s !== 'completed') || now - s.todosAt < 8000)).sort((a, b) => b.last - a.last)
  const t = lists[0] && lists[0].todos
  const tasks = t ? { done: t.filter(x => x.s === 'completed').length, total: t.length, cur: t.findIndex(x => x.s === 'in_progress') } : null
  const since = list.filter(s => s.busy && s.busySince).map(s => s.busySince)
  const multi = list.filter(s => now - s.last < 30 * 60 * 1000).sort((a, b) => b.last - a.last).slice(0, 4)
    .map(s => ({ id: s.id, name: s.cwd ? path.basename(s.cwd).slice(0, 14) : 'session', st: s.waiting ? 'wait' : s.busy ? 'busy' : now < s.doneUntil ? 'done' : 'idle' }))
  const err = list.find(s => now < s.errorUntil)
  const ctxS = list.find(s => s.ctx >= CTX_WARN && now - s.last < 30 * 60 * 1000)
  const action = err ? err.errText : tooling ? actionOf(tooling).slice(0, 70) : ctxS ? `Context ${Math.round(ctxS.ctx)}% full` : ''
  return { sessions: multi.length > 1 ? multi : [], action, tasks, busySince: since.length ? Math.min(...since) : 0, helpers: list.reduce((n, s) => n + helperCount(s), 0) }
}

let usage = null
const toMs = v => (typeof v === 'number' ? (v < 1e12 ? v * 1000 : v) : Date.parse(v))
const normWindow = w => {
  if (!w) return null
  const pct = w.used_percentage ?? w.percentUsed ?? w.utilization
  const at = toMs(w.resets_at ?? w.resetsAt)
  return typeof pct === 'number' && at ? { pct: Math.round(pct), at } : null
}
const sendUsage = () => { if (win && !win.isDestroyed()) win.webContents.send('usage', usage) }
const onUsage = u => {
  if (u.session && typeof u.ctx === 'number' && sessions.has(u.session)) sessions.get(u.session).ctx = u.ctx
  const five = normWindow(u.five), seven = normWindow(u.seven)
  if (!five && !seven) return
  usage = { five: five || (usage && usage.five) || null, seven: seven || (usage && usage.seven) || null }
  saveSettings({ usage })
  sendUsage()
}

let usageBackoff = 0
const pollUsage = async () => {
  if (Date.now() < usageBackoff) return
  try {
    const c = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.claude', '.credentials.json'), 'utf8')).claudeAiOauth
    if (!c || !c.accessToken || Date.now() > c.expiresAt) return
    const r = await fetch('https://api.anthropic.com/api/oauth/usage', { headers: { Authorization: `Bearer ${c.accessToken}`, 'anthropic-beta': 'oauth-2025-04-20' }, signal: AbortSignal.timeout(8000) })
    try { fs.writeFileSync(path.join(os.tmpdir(), 'claude-pet-usage-status.txt'), String(r.status)) } catch { void 0 }
    if (r.status === 429) { usageBackoff = Date.now() + 90 * 1000; return }
    if (!r.ok) return
    const j = await r.json()
    try { fs.writeFileSync(path.join(os.tmpdir(), 'claude-pet-usage.json'), JSON.stringify(j)) } catch { void 0 }
    onUsage({ five: j.five_hour, seven: j.seven_day })
  } catch { void 0 }
}

const WX_KIND = c => (c === 0 ? 'clear' : c <= 2 ? 'partly' : c === 3 ? 'cloudy' : c === 45 || c === 48 ? 'fog' : (c >= 51 && c <= 67) || (c >= 80 && c <= 82) ? 'rain' : (c >= 71 && c <= 77) || c === 85 || c === 86 ? 'snow' : c >= 95 ? 'storm' : 'clear')
let weather = 'clear'
let wxPreview = process.env.PET_WX || null
const getJson = async u => (await fetch(u, { signal: AbortSignal.timeout(8000) })).json()
const sendWeather = () => { if (win && !win.isDestroyed()) win.webContents.send('weather', loadSettings().weatherOff ? 'clear' : wxPreview || weather) }
const updateWeather = async () => {
  try {
    let loc = loadSettings().loc
    if (!loc || Date.now() - loc.at > 24 * 3600 * 1000) {
      const g = await getJson('https://ipwho.is/')
      if (g.success === false) return
      loc = { lat: g.latitude, lon: g.longitude, at: Date.now() }
      saveSettings({ loc })
    }
    const w = await getJson(`https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&current=weather_code`)
    if (w.current && typeof w.current.weather_code === 'number') { weather = WX_KIND(w.current.weather_code); sendWeather() }
  } catch { void 0 }
}

let helperSig = ''
let metaSig = ''
let expanded = false
let shrinkTimer = null
let programmatic = false
let compact = false
const targetH = () => (compact ? COMPACT_H : WIN_H + (expanded ? UG_H : 0))
const applySize = () => {
  if (!win || win.isDestroyed()) return
  const b = win.getBounds()
  const h = targetH()
  if (b.height === h) return
  programmatic = true
  win.setBounds({ x: b.x, y: b.y + b.height - h, width: WIN_W, height: h })
  setTimeout(() => { programmatic = false }, 300)
}
const resizeFor = open => {
  if (open === expanded) return
  expanded = open
  applySize()
}
const tick = () => {
  if (!win || win.isDestroyed()) return
  const now = Date.now()
  const state = preview || stateOf(now)
  const project = projectOf()
  const helpers = helpersNow(now)
  const sig = helpers.map(h => `${h.id}:${h.state}`).join('|')
  if (sig !== helperSig) {
    helperSig = sig
    if (helpers.length) { clearTimeout(shrinkTimer); shrinkTimer = null; resizeFor(true) }
    else if (!shrinkTimer) shrinkTimer = setTimeout(() => { shrinkTimer = null; if (!helperSig) resizeFor(false) }, 700)
    win.webContents.send('helpers', helpers)
  }
  const meta = metaNow(now)
  const msig = JSON.stringify(meta)
  if (msig !== metaSig) { metaSig = msig; win.webContents.send('meta', meta) }
  const tooSoon = now - sceneStartedAt < MIN_SCENE_MS && !URGENT.has(state)
  if (state !== current.state && !tooSoon) {
    current = { state, project }
    sceneStartedAt = now
    win.webContents.send('state', current)
  } else if (project !== current.project) {
    current.project = project
    win.webContents.send('state', { ...current, keep: true })
  }
}

const readJson = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')) } catch { return {} } }
const helperInfo = id => {
  const now = Date.now()
  for (const s of sessions.values()) {
    const a = s.agents.get(id)
    if (!a) continue
    const info = { state: a.tool && (a.running > 0 || now < a.toolUntil) ? a.tool : 'thinking', start: a.first, name: '', type: '', model: '', tokens: 0 }
    if (s.transcript) {
      const base = path.join(path.dirname(s.transcript), s.id, 'subagents', `agent-${id}`)
      const meta = readJson(`${base}.meta.json`)
      info.name = meta.description || ''
      info.type = meta.agentType || ''
      try {
        const seen = new Map()
        for (const line of fs.readFileSync(`${base}.jsonl`, 'utf8').split(String.fromCharCode(10))) {
          if (!line) continue
          let o; try { o = JSON.parse(line) } catch { continue }
          if (o.timestamp && (!info.start || Date.parse(o.timestamp) < info.start)) info.start = Date.parse(o.timestamp)
          const m = o.message
          if (m && m.role === 'assistant') {
            if (m.model) info.model = m.model
            const u = m.usage
            if (u) seen.set(m.id || o.uuid, (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.output_tokens || 0))
          }
        }
        for (const v of seen.values()) info.tokens += v
      } catch { void 0 }
    }
    return info
  }
  return null
}
ipcMain.handle('focus-session', (_, id) => {
  const s = sessions.get(id)
  if (!s || !s.ppid || process.platform !== 'win32') return
  const ps = [
    'Add-Type @"', 'using System; using System.Runtime.InteropServices;', 'public class FG { [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h); [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c); [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h); }', '"@',
    `$p = ${Number(s.ppid)}`,
    'for ($i = 0; $i -lt 12 -and $p; $i++) { $pr = Get-Process -Id $p -ErrorAction SilentlyContinue; if ($pr -and $pr.MainWindowHandle -ne 0) { if ([FG]::IsIconic($pr.MainWindowHandle)) { [void][FG]::ShowWindow($pr.MainWindowHandle, 9) }; [void][FG]::SetForegroundWindow($pr.MainWindowHandle); break }; $q = Get-CimInstance Win32_Process -Filter "ProcessId=$p" -ErrorAction SilentlyContinue; $p = if ($q) { $q.ParentProcessId } else { 0 } }',
  ].join(CRLF)
  spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps], { windowsHide: true })
})
ipcMain.handle('helper-info', (_, id) => helperInfo(id))

const settingsFile = () => path.join(app.getPath('userData'), 'window.json')
const loadSettings = () => { try { return JSON.parse(fs.readFileSync(settingsFile(), 'utf8')) } catch { return {} } }
const saveSettings = patch => fs.writeFileSync(settingsFile(), JSON.stringify({ ...loadSettings(), ...patch }))
const savePos = () => { if (win && !programmatic) { const b = win.getBounds(); saveSettings({ x: b.x, bottom: b.y + b.height }) } }

const cornerPos = () => {
  const a = screen.getPrimaryDisplay().workArea
  return [a.x + a.width - WIN_W - 16, a.y + a.height - 16]
}

let userHidden = false
let fsHidden = false
const syncVisible = () => {
  if (!win || win.isDestroyed()) return
  const want = !userHidden && !fsHidden
  if (want && !win.isVisible()) win.showInactive()
  else if (!want && win.isVisible()) win.hide()
}

const pushAll = () => {
  if (!win || win.isDestroyed()) return
  win.webContents.send('prefs', { compact, chatter: !loadSettings().chatterOff })
  win.webContents.send('state', current)
  sendWeather()
  sendUsage()
  helperSig = ''
  metaSig = ''
}

const createWindow = () => {
  const saved = loadSettings()
  compact = !!saved.compact
  usage = saved.usage || null
  const [cx, cbottom] = cornerPos()
  const h = targetH()
  const bottom = saved.bottom ?? (saved.y !== undefined ? saved.y + WIN_H : cbottom)
  win = new BrowserWindow({
    width: WIN_W, height: h, x: saved.x ?? cx, y: bottom - h,
    frame: false, transparent: true, resizable: false, maximizable: false, minimizable: false, skipTaskbar: true,
    alwaysOnTop: true, hasShadow: false, show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true },
  })
  win.setAlwaysOnTop(true, 'screen-saver')
  win.loadFile(path.join(__dirname, 'index.html'), process.env.PET_HOUR ? { query: { hour: process.env.PET_HOUR } } : undefined)
  win.once('ready-to-show', () => win.showInactive())
  win.on('moved', savePos)
  win.webContents.on('did-finish-load', pushAll)
}

const FS_SCRIPT = [
  'Add-Type @"',
  'using System; using System.Text; using System.Runtime.InteropServices;',
  'public class FSW {',
  '  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }',
  '  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();',
  '  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);',
  '  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint p);',
  '  [DllImport("user32.dll")] public static extern int GetClassName(IntPtr h, StringBuilder s, int n);',
  '}',
  '"@',
  'while ($true) {',
  '  $h = [FSW]::GetForegroundWindow(); $r = New-Object FSW+RECT; [void][FSW]::GetWindowRect($h, [ref]$r)',
  '  $p = 0; [void][FSW]::GetWindowThreadProcessId($h, [ref]$p)',
  '  $sb = New-Object System.Text.StringBuilder 256; [void][FSW]::GetClassName($h, $sb, 256)',
  '  [Console]::Out.WriteLine("$($r.L) $($r.T) $($r.R) $($r.B) $p $($sb.ToString())"); [Console]::Out.Flush()',
  '  Start-Sleep -Milliseconds 1500',
  '}',
].join(CRLF)
const SHELL_CLASSES = new Set(['Progman', 'WorkerW', 'Shell_TrayWnd', 'Shell_SecondaryTrayWnd'])
let fsProc = null
const startFsWatch = () => {
  if (fsProc || process.platform !== 'win32') return
  const file = path.join(os.tmpdir(), 'claude-desktop-pet-fs.ps1')
  fs.writeFileSync(file, FS_SCRIPT)
  fsProc = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', file], { windowsHide: true })
  let buf = ''
  fsProc.stdout.on('data', d => {
    buf += d
    const lines = buf.split(String.fromCharCode(10))
    buf = lines.pop()
    const line = lines.pop()
    if (!line) return
    const [l, t, r, b, pid, cls] = line.trim().split(' ')
    const rect = { l: +l, t: +t, r: +r, b: +b }
    const full = Number(pid) !== process.pid && !SHELL_CLASSES.has(cls) && screen.getAllDisplays().some(d => {
      const p = screen.dipToScreenRect(null, d.bounds)
      return rect.l <= p.x + 1 && rect.t <= p.y + 1 && rect.r >= p.x + p.width - 1 && rect.b >= p.y + p.height - 1
    })
    if (full !== fsHidden) { fsHidden = full; syncVisible() }
  })
  fsProc.on('exit', () => { fsProc = null })
}
const stopFsWatch = () => { if (fsProc) fsProc.kill(); fsProc = null; fsHidden = false; syncVisible() }

// Electron 33 writes these directly to the Windows Run command line.
const startupOptions = { path: `"${process.execPath}"`, args: [`"${__dirname}"`] }
const startsWithWindows = () => app.getLoginItemSettings(startupOptions).openAtLogin
const setStartup = on => app.setLoginItemSettings({ openAtLogin: on, ...startupOptions })
const repairStartup = () => {
  const legacy = app.getLoginItemSettings({ path: process.execPath, args: [__dirname] })
  // Only migrate an existing enabled entry; preserve the user's opt-out.
  if (!startsWithWindows() && legacy.openAtLogin && legacy.launchItems.some(item => item.enabled)) setStartup(true)
}
const toggle = () => { userHidden = win.isVisible(); syncVisible() }

const snap = corner => {
  const b = win.getBounds()
  const a = screen.getDisplayNearestPoint({ x: b.x + b.width / 2, y: b.y + b.height / 2 }).workArea
  const x = corner.includes('left') ? a.x + 16 : a.x + a.width - b.width - 16
  const y = corner.includes('top') ? a.y + 16 : a.y + a.height - b.height - 16
  win.setBounds({ x, y, width: b.width, height: b.height })
  savePos()
}
const WEATHER = ['clear', 'partly', 'cloudy', 'fog', 'rain', 'snow', 'storm']

const buildMenu = () => Menu.buildFromTemplate([
  { label: 'Show / hide', click: toggle },
  { label: 'Compact mode', type: 'checkbox', checked: compact, click: item => { compact = item.checked; saveSettings({ compact }); applySize(); win.webContents.send('prefs', { compact, chatter: !loadSettings().chatterOff }); savePos() } },
  { label: 'Idle chatter', type: 'checkbox', checked: !loadSettings().chatterOff, click: item => { saveSettings({ chatterOff: !item.checked }); win.webContents.send('prefs', { compact, chatter: item.checked }) } },
  { label: 'Weather effects', type: 'checkbox', checked: !loadSettings().weatherOff, click: item => { saveSettings({ weatherOff: !item.checked }); sendWeather() } },
  { label: 'Hide in fullscreen apps', type: 'checkbox', checked: loadSettings().hideFullscreen !== false, click: item => { saveSettings({ hideFullscreen: item.checked }); if (item.checked) startFsWatch(); else stopFsWatch() } },
  { label: 'Snap to corner', submenu: [['Top left', 'top-left'], ['Top right', 'top-right'], ['Bottom left', 'bottom-left'], ['Bottom right', 'bottom-right']].map(([label, c]) => ({ label, click: () => snap(c) })) },
  { label: 'Start with Windows', type: 'checkbox', checked: startsWithWindows(), click: item => setStartup(item.checked) },
  { label: 'Reset position', click: () => { const [x, bottom] = cornerPos(); const h = win.getBounds().height; win.setBounds({ x, y: bottom - h, width: WIN_W, height: h }); savePos() } },
  { label: 'Play a random gag', click: () => win.webContents.executeJavaScript('window.gag && window.gag()').catch(() => {}) },
  { label: 'Preview animation', submenu: [{ label: 'Live (auto)', click: () => { preview = null } }, ...PREVIEWS.map(s => ({ label: s, click: () => { preview = s } }))] },
  { label: 'Preview weather', submenu: [{ label: 'Live (local)', click: () => { wxPreview = null; sendWeather() } }, ...WEATHER.map(w => ({ label: w, click: () => { wxPreview = w; sendWeather() } }))] },
  { type: 'separator' },
  { label: 'Quit', click: () => app.quit() },
])

app.whenReady().then(() => {
  if (!gotLock) return
  createWindow()
  tray = new Tray(nativeImage.createFromPath(path.join(__dirname, 'assets', 'icon.png')))
  tray.setToolTip('Claude Desktop Pet')
  tray.on('click', toggle)
  tray.on('right-click', () => tray.popUpContextMenu(buildMenu()))
  if (!loadSettings().startupSet) { setStartup(true); saveSettings({ startupSet: true }) }
  else repairStartup()

  http.createServer((req, res) => {
    if (req.method !== 'POST' || (req.url !== '/event' && req.url !== '/usage')) { res.writeHead(404).end(); return }
    let body = ''
    req.on('data', c => { body += c; if (body.length > 40000) req.destroy() })
    req.on('end', () => {
      try { (req.url === '/usage' ? onUsage : onEvent)(JSON.parse(body)) } catch (err) { void err }
      res.writeHead(204).end()
    })
  }).listen(PORT, '127.0.0.1')

  setInterval(tick, 400)
  updateWeather()
  pollUsage()
  setInterval(pollUsage, 2 * 60 * 1000)
  setInterval(updateWeather, 20 * 60 * 1000)
  if (loadSettings().hideFullscreen !== false) startFsWatch()
})

app.on('second-instance', () => { if (win) win.showInactive() })
app.on('before-quit', () => { if (fsProc) fsProc.kill(); if (tray) { tray.destroy(); tray = null } })
app.on('window-all-closed', () => {})
