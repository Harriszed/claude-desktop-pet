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

function installer(overrides = {}) {
  const updater = new EventEmitter()
  const calls = { checked: 0, downloaded: 0, installed: [] }
  updater.checkForUpdates = async () => { calls.checked++; return { updateInfo: { version: '1.4.0' } } }
  updater.downloadUpdate = async () => { calls.downloaded++; updater.emit('download-progress', { percent: 42 }); return ['Setup.exe'] }
  updater.quitAndInstall = (...args) => calls.installed.push(args)
  Object.assign(updater, overrides)
  return { ...fixture({ app: { isPackaged: true, getVersion: () => '1.3.0' }, updater }), updater, calls }
}
test('Settings checks, downloads and installs the Windows exe as separate explicit actions', async () => {
  const { updates, messages, calls, updater } = installer()
  await updates.settingsAction()
  assert.equal(updates.status().phase, 'available')
  assert.equal(updates.status().automaticInstall, true)
  assert.equal(calls.downloaded, 0)
  await updates.settingsAction()
  assert.equal(updates.status().phase, 'downloaded')
  assert.equal(calls.downloaded, 1)
  assert.deepEqual(calls.installed, [])
  assert.equal(messages.length, 0)
  assert.equal(updater.autoInstallOnAppQuit, false)
  await updates.settingsAction()
  assert.equal(updates.status().phase, 'installing')
  assert.deepEqual(calls.installed, [[true, true]])
  await updates.settingsAction()
  assert.equal(calls.installed.length, 1)
})
test('Settings keeps a failed download available for retry', async () => {
  const { updates, updater, calls } = installer({ downloadUpdate: async () => { throw new Error('offline') } })
  await updates.settingsAction()
  await updates.settingsAction()
  assert.equal(updates.status().phase, 'available')
  assert.match(updates.status().message, /try again/)
  updater.downloadUpdate = async () => { calls.downloaded++ }
  await updates.settingsAction()
  assert.equal(updates.status().phase, 'downloaded')
})
test('failed installer starts retain the download for retry', async () => {
  const { updates, updater } = installer({ quitAndInstall: () => { throw new Error('locked') } })
  await updates.settingsAction()
  await updates.settingsAction()
  await updates.settingsAction()
  assert.equal(updates.status().phase, 'downloaded')
  updater.quitAndInstall = () => updater.emit('error', new Error('cannot spawn'))
  await updates.settingsAction()
  assert.equal(updates.status().phase, 'downloaded')
})
test('Settings does not duplicate in-flight downloads', async () => {
  let finish
  const { updates } = installer({ downloadUpdate: () => new Promise(resolve => { finish = resolve }) })
  await updates.settingsAction()
  const downloading = updates.settingsAction()
  await updates.settingsAction()
  assert.equal(updates.status().phase, 'downloading')
  finish()
  await downloading
  assert.equal(updates.status().phase, 'downloaded')
})
test('source copies show a release link without attempting exe installation', async () => {
  const { updates, messages, links } = fixture({ fetcher: async () => ({ ok: true, json: async () => [{ name: 'v1.4.0' }] }) })
  await updates.settingsAction()
  assert.equal(updates.status().automaticInstall, false)
  await updates.settingsAction()
  assert.deepEqual(links, ['https://github.com/Harriszed/claude-desktop-pet/releases/latest'])
  assert.deepEqual(messages, [])
})
