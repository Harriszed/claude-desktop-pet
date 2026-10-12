const { test } = require('node:test')
const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const { createUpdates, isNewer } = require('../updates')
function fixture(overrides = {}) {
  const messages = [], links = [], saved = []
  const options = { app: { isPackaged: false, getVersion: () => '1.3.0' }, platform: 'win32', env: {},
    dialog: { showMessageBox: async message => { messages.push(message); return { response: 1 } } },
    shell: { openExternal: async url => links.push(url) },
    loadSettings: () => ({}), saveSettings: patch => saved.push(patch),
    fetcher: async () => ({ ok: true, json: async () => [{ name: 'v1.2.0' }, { name: 'v1.3.0' }] }), ...overrides }
  return { updates: createUpdates(options), messages, links, saved }
}
test('semantic versions compare numerically', () => {
  assert.equal(isNewer('v1.10.0', '1.9.9'), true)
  assert.equal(isNewer('1.3.0', '1.3.0'), false)
  assert.equal(isNewer('1.2.9', '1.3.0'), false)
})
test('automatic up-to-date checks stay quiet', async () => {
  const { updates, messages, saved } = fixture()
  await updates.check(false)
  assert.equal(updates.status().phase, 'current')
  assert.equal(messages.length, 0)
  assert.equal(saved.length, 1)
})
test('GitHub errors do not claim up-to-date or postpone the next daily check', async () => {
  const { updates, messages, saved } = fixture({ fetcher: async () => ({ ok: false }) })
  await updates.check(true)
  assert.equal(updates.status().phase, 'error')
  assert.equal(messages[0].type, 'warning')
  assert.equal(saved.length, 0)
})
test('unsigned macOS checks releases, ignores prereleases and opens downloads', async () => {
  let endpoint
  const { updates, links } = fixture({ app: { isPackaged: true, getVersion: () => '1.3.0' }, platform: 'darwin',
    fetcher: async url => { endpoint = url; return { ok: true, json: async () => [{ tag_name: 'v9.0.0', prerelease: true }, { tag_name: 'v1.4.0' }] } },
    dialog: { showMessageBox: async () => ({ response: 0 }) } })
  await updates.check(true)
  assert.ok(endpoint.includes('/releases?'))
  assert.ok(updates.status().message.includes('1.4.0'))
  assert.ok(links[0].endsWith('/releases/latest'))
})
test('Windows installer downloads only on request and restarts only after confirmation', async () => {
  const updater = new EventEmitter()
  let downloaded = 0, installed = 0, prompted = 0
  updater.checkForUpdates = async () => ({ updateInfo: { version: '1.4.0' } })
  updater.downloadUpdate = async () => { downloaded++ }
  updater.quitAndInstall = () => { installed++ }
  const { updates } = fixture({ app: { isPackaged: true, getVersion: () => '1.3.0' }, updater,
    dialog: { showMessageBox: async () => ({ response: prompted++ === 0 ? 0 : 1 }) } })
  await updates.check(true)
  assert.equal(updater.autoDownload, false)
  assert.equal(updater.autoInstallOnAppQuit, false)
  assert.equal(downloaded, 1)
  assert.equal(installed, 0)
  assert.equal(updates.status().phase, 'downloaded')
  updates.install()
  assert.equal(installed, 1)
})
test('concurrent checks share one request', async () => {
  let resolve, calls = 0
  const { updates } = fixture({ fetcher: () => { calls++; return new Promise(done => { resolve = done }) } })
  const first = updates.check()
  await updates.check()
  resolve({ ok: true, json: async () => [{ name: 'v1.3.0' }] })
  await first
  assert.equal(calls, 1)
})
