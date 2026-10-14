// Download a real installer through Settings from an isolated local feed.
// The final installer launch is intercepted; this never installs over the user's app.
const { _electron: electron } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('fs'), path = require('path'), os = require('os'), http = require('http'), crypto = require('crypto')
const root = path.join(__dirname, '..'), version = require('../package.json').version
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pet-update-smoke-'))
const installer = path.join(root, 'dist', `Claude-Desktop-Pet-${version}-Setup-x64.exe`)
const sha512 = crypto.createHash('sha512').update(fs.readFileSync(installer)).digest('base64')
const nextVersion = version.split('.').map((v, i) => i === 2 ? Number(v) + 1 : v).join('.')
const file = 'Test-Setup.exe'
const feed = JSON.stringify({ version: nextVersion, files: [{ url: file, sha512, size: fs.statSync(installer).size }], path: file, sha512 })
let requests = 0, app, server
async function main() {
  server = http.createServer((req, res) => {
    if (req.url.split('?')[0] === '/latest.yml') { res.writeHead(200, { 'Content-Type': 'text/yaml' }); res.end(feed) }
    else if (req.url.split('?')[0] === `/${file}`) { requests++; res.writeHead(200, { 'Content-Length': fs.statSync(installer).size }); fs.createReadStream(installer).pipe(res) }
    else res.writeHead(404).end()
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const env = { ...process.env, PET_TEST_DATA: dir, PET_TEST_PORT: '47934', PET_TEST_CLAUDE_SETTINGS: path.join(dir, 'claude.json'), PET_OPEN_SETTINGS: '1' }
  delete env.ELECTRON_RUN_AS_NODE
  fs.writeFileSync(path.join(dir, 'window.json'), JSON.stringify({ updateCheckedAt: Date.now(), weatherOff: true, hideFullscreen: false, bootSequence: false }))
  app = await electron.launch({ executablePath: path.join(root, 'dist', 'win-unpacked', 'Claude Desktop Pet.exe'), args: [], env })
  await app.firstWindow()
  let settings
  for (let i = 0; i < 50; i++) {
    settings = app.windows().find(page => page.url().endsWith('/settings.html'))
    if (settings) break
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  assert.ok(settings)
  const errors = []
  settings.on('pageerror', error => errors.push(error.message))
  await settings.waitForSelector(`#version:has-text("${version}")`)
  await app.evaluate(({ app }, options) => {
    const requireApp = process.getBuiltinModule('module').createRequire(app.getAppPath() + '/main.js')
    const updater = requireApp('electron-updater').autoUpdater
    Object.defineProperty(updater.app, 'baseCachePath', { value: options.dir })
    updater.setFeedURL({ provider: 'generic', url: options.url })
    updater.disableDifferentialDownload = true
    updater.quitAndInstall = (...args) => { global.updateSmokeInstallArgs = args }
  }, { dir, url: `http://127.0.0.1:${server.address().port}` })
  await settings.locator('#check-updates').click()
  await settings.waitForFunction(() => document.querySelector('#check-updates').textContent === 'Download update')
  assert.equal(requests, 0, 'checks do not download automatically')
  await settings.locator('#check-updates').click()
  await settings.waitForFunction(() => document.querySelector('#check-updates').textContent === 'Restart and install', null, { timeout: 60000 })
  assert.equal(requests, 1)
  const downloaded = await app.evaluate(({ app }) => process.getBuiltinModule('module').createRequire(app.getAppPath() + '/main.js')('electron-updater').autoUpdater.installerPath)
  assert.ok(path.resolve(downloaded).startsWith(path.resolve(dir) + path.sep))
  assert.equal(crypto.createHash('sha512').update(fs.readFileSync(downloaded)).digest('base64'), sha512)
  assert.equal(await app.evaluate(() => global.updateSmokeInstallArgs), undefined)
  const output = path.join(root, 'output', 'playwright')
  fs.mkdirSync(output, { recursive: true })
  await settings.locator('#startup-title').scrollIntoViewIfNeeded()
  await settings.screenshot({ path: path.join(output, 'settings-update-ready.png') })
  await settings.locator('#check-updates').click()
  assert.deepEqual(await app.evaluate(() => global.updateSmokeInstallArgs), [true, true])
  assert.equal(await settings.locator('#check-updates').textContent(), 'Installing…')
  assert.equal(await settings.locator('#check-updates').isDisabled(), true)
  assert.deepEqual(errors, [])
  console.log('Update smoke passed: real installer download, checksum verification, Settings button states and explicit restart request.')
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(async () => {
  if (app) await app.close()
  if (server) await new Promise(resolve => server.close(resolve))
  fs.rmSync(dir, { recursive: true, force: true })
})
