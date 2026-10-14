const { test } = require('node:test')
const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const path = require('path')
const { hookCommand } = require('../hook-settings')
const { createConnectionTest, parsePetCommand } = require('../connection-test')
const hook = path.join(__dirname, '..', 'hook.js')

test('test parses generated Windows and POSIX commands without invoking a shell', () => {
  for (const platform of ['win32', 'darwin', 'linux']) {
    for (const packaged of [false, true]) {
      const options = { platform, packaged, executable: "C:/My Pet's/runtime", hook: "C:/My Pet's/hook.js" }
      assert.deepEqual(parsePetCommand(hookCommand(options)), { executable: options.executable, hook: options.hook, packaged })
    }
  }
  assert.throws(() => parsePetCommand("'node' 'hook.js' --claude-desktop-pet; echo unexpected"), /Repair/)
  const injected = "& 'node' 'hook.js' '--claude-desktop-pet'; Write-Output unexpected"
  assert.throws(() => parsePetCommand(`powershell.exe -NoProfile -NonInteractive -EncodedCommand ${Buffer.from(injected, 'utf16le').toString('base64')}`), /Repair/)
})
function fixture(overrides = {}) {
  let launch
  const child = new EventEmitter()
  child.exitCode = null
  child.kill = () => {}
  const runner = createConnectionTest({
    getCommand: () => hookCommand({ executable: 'test-runtime', hook, platform: 'win32', packaged: true }),
    spawnHook: (...args) => { launch = args; return child },
    timeoutMs: 50,
    ...overrides,
  })
  return { runner, child, launch: () => launch }
}
test('only the matching test message confirms a connection', async () => {
  const { runner, launch } = fixture()
  const result = runner.test()
  const [executable, args, options] = launch()
  assert.equal(executable, 'test-runtime')
  assert.equal(options.env.ELECTRON_RUN_AS_NODE, '1')
  assert.equal(runner.receive({ nonce: 'another-test' }), false)
  assert.equal(runner.receive({ nonce: args.at(-1) }), true)
  assert.equal((await result).phase, 'passed')
  assert.equal(runner.receive({ nonce: args.at(-1) }), false)
})
test('silent hook exits cannot falsely pass the connection test', async () => {
  const { runner, child } = fixture()
  const result = runner.test()
  child.emit('exit', 0)
  assert.equal((await result).phase, 'failed')
  assert.match(runner.status().message, /No test message/)
})
test('missing connections and unavailable runtimes give repair instructions', async () => {
  const disconnected = fixture({ getCommand: () => { throw new Error('Connect Claude Code first.') } })
  assert.equal((await disconnected.runner.test()).phase, 'failed')
  assert.equal(disconnected.launch(), undefined)
  const { runner, child } = fixture()
  const result = runner.test()
  child.emit('error', new Error('ENOENT'))
  assert.equal((await result).phase, 'failed')
  assert.match(runner.status().message, /Repair connection/)
})
test('concurrent tests share one launch and closing the app cancels a test', async () => {
  const { runner } = fixture()
  const first = runner.test()
  assert.equal(runner.test(), first)
  runner.dispose()
  assert.equal((await first).phase, 'failed')
})
