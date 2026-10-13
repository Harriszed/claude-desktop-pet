// Exercise the real Electron app in isolated settings and a separate hook port.
const { _electron: electron } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('fs'), path = require('path'), os = require('os')
const { spawn } = require('child_process')
const root = path.join(__dirname, '..')
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-pet-smoke-'))
const port = 47931
const env = { ...process.env, PET_TEST_DATA: dir, PET_TEST_PORT: String(port), PET_TEST_CLAUDE_SETTINGS: path.join(dir, 'claude.json'), PET_OPEN_SETTINGS: '1' }
delete env.ELECTRON_RUN_AS_NODE
fs.writeFileSync(path.join(dir, 'window.json'), JSON.stringify({ updateCheckedAt: Date.now(), weatherOff: true, hideFullscreen: false, startupSet: true }))
const packaged = process.argv.includes('--packaged')
const executablePath = packaged ? path.join(root, 'dist', 'win-unpacked', 'Claude Desktop Pet.exe') : undefined
let app
async function executeHook(command, input) {
  assert.ok(command.startsWith('powershell.exe '))
  const args = command.split(' ').slice(1)
  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', args, { env, windowsHide: true })
    let stderr = ''
    child.stderr.on('data', bytes => { stderr += bytes })
    child.on('error', reject)
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`Hook exited ${code}: ${stderr}`)))
    child.stdin.end(JSON.stringify(input))
  })
}
async function main() {
  app = await electron.launch({ executablePath, args: packaged ? [] : [root], env })
  await app.firstWindow()
  let settings
  for (let i = 0; i < 50; i++) {
    settings = app.windows().find(page => page.url().endsWith('/settings.html'))
    if (settings) break
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  assert.ok(settings, 'settings window opens')
  await settings.waitForSelector(`#version:has-text("${require('../package.json').version}")`)
  const errors = []
  settings.on('pageerror', error => errors.push(error.message))
  const pet = app.windows().find(page => page.url().endsWith('/index.html'))
  assert.ok(pet)
  pet.on('pageerror', error => errors.push(error.message))
  assert.equal(await settings.locator('#sound').isChecked(), false)
  await settings.locator('#scale').selectOption('0.6')
  await settings.waitForFunction(() => document.querySelector('#feedback').textContent === 'Saved.')
  assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(w => w.webContents.getURL().endsWith('/index.html')).getBounds().width), 204)
  await settings.locator('#alwaysOnTop').uncheck()
  await settings.waitForFunction(() => document.querySelector('#alwaysOnTop').checked === false)
  await settings.locator('#sound').check()
  await settings.locator('#soundVolume').fill('50')
  await settings.locator('#soundVolume').dispatchEvent('change')
  await settings.locator('#test-sound').click()
  await pet.waitForFunction(() => typeof audioContext !== 'undefined' && audioContext.state === 'running')
  await settings.locator('#compact').check()
  await pet.waitForFunction(() => document.body.classList.contains('compact'))
  await settings.locator('#compact').uncheck()
  await settings.locator('#scale').selectOption('1')
  fs.writeFileSync(env.PET_TEST_CLAUDE_SETTINGS, '{broken')
  await settings.locator('#connect').click()
  await settings.waitForFunction(() => document.querySelector('#feedback').classList.contains('error'))
  const statusBounds = await settings.locator('#feedback').boundingBox()
  assert.ok(statusBounds.y >= 0 && statusBounds.y + statusBounds.height <= await settings.evaluate(() => innerHeight), 'connection errors stay visible')
  fs.writeFileSync(env.PET_TEST_CLAUDE_SETTINGS, '{}')
  await settings.locator('#connect').click()
  await settings.waitForFunction(() => document.querySelector('#connection-status').textContent.includes('Connected.'))
  const hooks = JSON.parse(fs.readFileSync(env.PET_TEST_CLAUDE_SETTINGS, 'utf8'))
  await executeHook(hooks.hooks.UserPromptSubmit[0].hooks[0].command, { hook_event_name: 'UserPromptSubmit', session_id: 'smoke', cwd: 'C:\\Demo' })
  await pet.waitForFunction(() => document.querySelector('#label').textContent.includes('Thinking'), null, { timeout: 10000 })
  await executeHook(hooks.statusLine.command, { session_id: 'smoke', rate_limits: { five_hour: { used_percentage: 25, resets_at: new Date(Date.now() + 3600000).toISOString() } } })
  await pet.waitForFunction(() => document.querySelector('#usage').textContent.includes('25'))
  await executeHook(hooks.hooks.Stop[0].hooks[0].command, { hook_event_name: 'Stop', session_id: 'smoke', cwd: 'C:\\Demo' })
  await pet.waitForFunction(() => document.querySelector('#label').textContent.includes('Done'), null, { timeout: 10000 })
  await settings.locator('#disconnect').click()
  await settings.waitForFunction(() => document.querySelector('#disconnect').hidden)
  assert.deepEqual(JSON.parse(fs.readFileSync(env.PET_TEST_CLAUDE_SETTINGS)), {})
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'window.json'))).soundVolume, 50)
  const output = path.join(root, 'output', 'playwright')
  fs.mkdirSync(output, { recursive: true })
  // Full-page documentation unfolds the fixed footer; native viewport captures
  // below demonstrate its real pinned position without obscuring preferences.
  const fullPageStyle = 'footer { position: static !important; } main { padding-bottom: 0 !important; }'
  async function captureFullPage(name) {
    // Electron's trusted CSS insertion works under the production CSP; ordinary
    // screenshot style tags are correctly blocked by style-src 'self'.
    const key = await app.evaluate(({ BrowserWindow }, css) => BrowserWindow.getAllWindows().find(w => w.webContents.getURL().endsWith('/settings.html')).webContents.insertCSS(css), fullPageStyle)
    assert.equal(await settings.evaluate(() => getComputedStyle(document.querySelector('footer')).position), 'static')
    await settings.screenshot({ path: path.join(output, name), fullPage: true })
    await app.evaluate(({ BrowserWindow }, cssKey) => BrowserWindow.getAllWindows().find(w => w.webContents.getURL().endsWith('/settings.html')).webContents.removeInsertedCSS(cssKey), key)
  }
  await captureFullPage(packaged ? 'settings-packaged.png' : 'settings.png')
  await settings.evaluate(() => scrollTo(0, 0))
  await settings.screenshot({ path: path.join(output, 'settings-viewport.png') })
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(w => w.webContents.getURL().endsWith('/settings.html')).setBounds({ width: 420, height: 760 }))
  await captureFullPage('settings-narrow.png')
  await settings.evaluate(() => scrollTo(0, 0))
  await settings.screenshot({ path: path.join(output, 'settings-narrow-viewport.png') })
  await pet.screenshot({ path: path.join(output, 'pet.png') })
  const width = await settings.evaluate(() => ({ actual: document.documentElement.scrollWidth, viewport: innerWidth }))
  assert.ok(width.actual <= width.viewport, 'settings do not overflow horizontally')
  assert.deepEqual(errors, [])
  console.log(`${packaged ? 'Packaged' : 'Source'} smoke passed: settings, scaling, sound, hooks, status line, disconnect and persistence.`)
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(async () => {
  if (app) await app.close()
  fs.rmSync(dir, { recursive: true, force: true })
})
