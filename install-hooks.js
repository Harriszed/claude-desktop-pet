// Adds (or with --remove, removes) the desktop pet's hooks in ~/.claude/settings.json. Backs the file up first.
const fs = require('fs'), os = require('os'), path = require('path')
const file = path.join(os.homedir(), '.claude', 'settings.json')
const hook = path.join(__dirname, 'hook.js')
const command = `node "${hook}"`
const EVENTS = ['SessionStart', 'SessionEnd', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'PostToolUseFailure', 'Stop', 'SubagentStop', 'Notification', 'PreCompact']
let settings = {}
if (fs.existsSync(file)) {
  settings = JSON.parse(fs.readFileSync(file, 'utf8'))
  fs.copyFileSync(file, file + '.bak-desktop-pet')
} else fs.mkdirSync(path.dirname(file), { recursive: true })
settings.hooks = settings.hooks || {}
const mine = h => h && h.command && h.command.includes(hook)
for (const ev of EVENTS) {
  const groups = (settings.hooks[ev] || []).map(g => ({ ...g, hooks: (g.hooks || []).filter(h => !mine(h)) })).filter(g => g.hooks.length)
  if (!process.argv.includes('--remove')) groups.push({ matcher: '*', hooks: [{ type: 'command', command }] })
  if (groups.length) settings.hooks[ev] = groups; else delete settings.hooks[ev]
}
if (!Object.keys(settings.hooks).length) delete settings.hooks
// Usage readout: only claim the status line when the user has none of their own.
const slMine = settings.statusLine && settings.statusLine.command && settings.statusLine.command.includes(hook)
if (process.argv.includes('--remove')) { if (slMine) delete settings.statusLine }
else if (!settings.statusLine || slMine) settings.statusLine = { type: 'command', command: `node "${hook}" --statusline` }
else console.log('Note: you already have a status line, so the usage readout is off.')
fs.writeFileSync(file, JSON.stringify(settings, null, 2))
console.log(process.argv.includes('--remove') ? 'Hooks removed.' : 'Hooks installed for: ' + EVENTS.join(', '))
