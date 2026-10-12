const fs = require('fs')
const path = require('path')
const os = require('os')

const EVENTS = ['SessionStart', 'SessionEnd', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'PostToolUseFailure', 'Stop', 'SubagentStop', 'Notification', 'PreCompact']
const MARKER = '--claude-desktop-pet'
const shQuote = value => `'${String(value).replace(/'/g, `'"'"'`)}'`
const psQuote = value => `'${String(value).replace(/'/g, "''")}'`

function hookCommand({ executable, hook, platform = process.platform, packaged = false, statusline = false }) {
  const suffix = statusline ? ' --statusline' : ''
  if (platform === 'win32') {
    const script = `${packaged ? "$env:ELECTRON_RUN_AS_NODE='1'; " : ''}& ${psQuote(executable)} ${psQuote(hook)} ${psQuote(MARKER)}${suffix}`
    return `powershell.exe -NoProfile -NonInteractive -EncodedCommand ${Buffer.from(script, 'utf16le').toString('base64')}`
  }
  return `${packaged ? 'ELECTRON_RUN_AS_NODE=1 ' : ''}${shQuote(executable)} ${shQuote(hook)} ${MARKER}${suffix}`
}

function ownsHook(hook, legacyPaths = []) {
  const command = hook && hook.command
  if (typeof command !== 'string') return false
  if (command.includes(MARKER)) return true
  if (command.startsWith('powershell.exe -NoProfile -NonInteractive -EncodedCommand ')) {
    try { if (Buffer.from(command.split(' ').pop(), 'base64').toString('utf16le').includes(MARKER)) return true } catch {}
  }
  return legacyPaths.some(p => command.includes(p)) || /(?:claude-desktop-pet|Claude Desktop Pet)[\\/]hook\.js["']?(?:\s|$)/i.test(command)
}

function configureHooks({ file = path.join(os.homedir(), '.claude', 'settings.json'), command, statusCommand = `${command} --statusline`, remove = false, legacyPaths = [] }) {
  const settings = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {}
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) throw new Error('Claude settings must be a JSON object.')
  if (settings.hooks && (typeof settings.hooks !== 'object' || Array.isArray(settings.hooks))) throw new Error('Claude hooks must be a JSON object.')
  const mine = h => ownsHook(h, legacyPaths)
  settings.hooks = settings.hooks || {}
  for (const event of EVENTS) {
    const groups = (settings.hooks[event] || []).map(g => ({ ...g, hooks: (g.hooks || []).filter(h => !mine(h)) })).filter(g => g.hooks.length)
    if (!remove) groups.push({ matcher: '*', hooks: [{ type: 'command', command }] })
    if (groups.length) settings.hooks[event] = groups
    else delete settings.hooks[event]
  }
  if (!Object.keys(settings.hooks).length) delete settings.hooks
  const ownStatus = mine(settings.statusLine)
  if (remove) { if (ownStatus) delete settings.statusLine }
  else if (!settings.statusLine || ownStatus) settings.statusLine = { type: 'command', command: statusCommand }
  fs.mkdirSync(path.dirname(file), { recursive: true })
  if (fs.existsSync(file)) fs.copyFileSync(file, `${file}.bak-desktop-pet`)
  const temporary = `${file}.desktop-pet-tmp`
  fs.writeFileSync(temporary, JSON.stringify(settings, null, 2) + '\n')
  fs.renameSync(temporary, file)
  return { connected: !remove, usageEnabled: !remove && mine(settings.statusLine) }
}

function hooksConnected(file, legacyPaths = []) {
  try {
    const settings = JSON.parse(fs.readFileSync(file, 'utf8'))
    return EVENTS.every(event => (settings.hooks?.[event] || []).some(g => (g.hooks || []).some(h => ownsHook(h, legacyPaths))))
  } catch { return false }
}

module.exports = { EVENTS, MARKER, shQuote, hookCommand, ownsHook, configureHooks, hooksConnected }
