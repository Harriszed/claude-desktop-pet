const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs'), os = require('os'), path = require('path')
const { configureHooks, hookCommand, hooksConnected, ownsHook, EVENTS } = require('../hook-settings')
function fixture(t, content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pet-hooks-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const file = path.join(dir, 'settings.json')
  if (content !== undefined) fs.writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content))
  return file
}
test('connect, reconnect and disconnect preserve other hooks and a custom status line', t => {
  const unrelated = { matcher: 'Read', hooks: [{ type: 'command', command: 'echo other-hook' }] }
  const original = { theme: 'dark', hooks: { PreToolUse: [unrelated] }, statusLine: { type: 'command', command: 'echo my-status' } }
  const file = fixture(t, original)
  const options = { file, command: 'node hook.js --claude-desktop-pet' }
  assert.equal(configureHooks(options).usageEnabled, false)
  assert.equal(hooksConnected(file), true)
  configureHooks(options)
  let settings = JSON.parse(fs.readFileSync(file))
  for (const event of EVENTS) assert.equal(settings.hooks[event].filter(g => g.hooks.some(h => ownsHook(h))).length, 1)
  assert.deepEqual(settings.hooks.PreToolUse[0], unrelated)
  configureHooks({ ...options, remove: true })
  settings = JSON.parse(fs.readFileSync(file))
  assert.deepEqual(settings, original)
  assert.equal(hooksConnected(file), false)
})
test('invalid JSON is never overwritten', t => {
  const file = fixture(t, '{broken')
  assert.throws(() => configureHooks({ file, command: 'node hook.js' }))
  assert.equal(fs.readFileSync(file, 'utf8'), '{broken')
})
test('first connection creates a status line and a backup on subsequent changes', t => {
  const file = fixture(t)
  const command = 'node hook.js --claude-desktop-pet'
  configureHooks({ file, command })
  const original = fs.readFileSync(file, 'utf8')
  assert.equal(JSON.parse(original).statusLine.command, command + ' --statusline')
  configureHooks({ file, command, remove: true })
  assert.equal(fs.readFileSync(file + '.bak-desktop-pet', 'utf8'), original)
  assert.deepEqual(JSON.parse(fs.readFileSync(file)), {})
})
test('migration replaces old source hooks instead of installing duplicate listeners', t => {
  const file = fixture(t, { hooks: { Stop: [{ matcher: '*', hooks: [{ type: 'command', command: 'node "C:\\old folder\\claude-desktop-pet\\hook.js"' }] }] } })
  configureHooks({ file, command: 'node new.js --claude-desktop-pet' })
  assert.equal(JSON.parse(fs.readFileSync(file)).hooks.Stop.length, 1)
})
test('packaged Windows hook safely quotes paths and embeds status-line arguments', () => {
  const options = { platform: 'win32', packaged: true, executable: "C:\\Harris's $pet\\Pet.exe", hook: "C:\\User's Files\\hook.js" }
  const command = hookCommand(options)
  const status = hookCommand({ ...options, statusline: true })
  const decode = value => Buffer.from(value.split(' ').pop(), 'base64').toString('utf16le')
  assert.match(decode(command), /ELECTRON_RUN_AS_NODE='1'/)
  assert.ok(decode(command).includes("'C:\\Harris''s $pet\\Pet.exe'"))
  assert.match(decode(status), /--statusline$/)
  assert.equal(ownsHook({ command }), true)
  assert.equal(ownsHook({ command: status }), true)
})
test('POSIX hooks quote apostrophes and packaged runtimes', () => {
  const command = hookCommand({ platform: 'darwin', packaged: true, executable: "/Users/It's Me/Pet", hook: '/tmp/hook.js' })
  assert.ok(command.startsWith('ELECTRON_RUN_AS_NODE=1 '))
  assert.ok(command.includes("'It") === false)
  assert.ok(command.includes("It'\"'\"'s Me"))
})
