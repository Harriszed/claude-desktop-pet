// Real Electron checks for effects, interruption, visibility and saved preferences.
const { _electron: electron } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('fs'), path = require('path'), os = require('os')
const root = path.join(__dirname, '..')
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-pet-vfx-'))
const port = 47932
const env = { ...process.env, PET_TEST_DATA: dir, PET_TEST_PORT: String(port), PET_TEST_CLAUDE_SETTINGS: path.join(dir, 'claude.json'), PET_OPEN_SETTINGS: '1', PET_HOUR: '22' }
delete env.ELECTRON_RUN_AS_NODE
fs.writeFileSync(path.join(dir, 'window.json'), JSON.stringify({ updateCheckedAt: Date.now(), weatherOff: true, hideFullscreen: false }))
const packaged = process.argv.includes('--packaged')
const executablePath = packaged ? path.join(root, 'dist', 'win-unpacked', 'Claude Desktop Pet.exe') : undefined
let app
const errors = []
async function launch() {
  app = await electron.launch({ executablePath, args: packaged ? [] : [root], env })
  await app.firstWindow()
  let settings, pet
  for (let i = 0; i < 50; i++) {
    settings = app.windows().find(p => p.url().endsWith('/settings.html'))
    pet = app.windows().find(p => p.url().includes('/index.html'))
    if (settings && pet) break
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  assert.ok(settings && pet)
  for (const page of [settings, pet]) page.on('pageerror', error => errors.push(error.message))
  await settings.waitForSelector(`#version:has-text("${require('../package.json').version}")`)
  return { settings, pet }
}
const event = name => fetch(`http://127.0.0.1:${port}/event`, { method: 'POST', body: JSON.stringify({ event: name, session: 'vfx-smoke', cwd: 'C:\\Demo' }) })
async function main() {
  let { settings, pet } = await launch()
  const output = path.join(root, 'output', 'playwright')
  fs.mkdirSync(output, { recursive: true })
  await pet.waitForFunction(() => !document.querySelector('.fx-boot').hidden)
  await pet.screenshot({ path: path.join(output, 'vfx-boot.png') })
  await pet.waitForFunction(() => document.querySelector('.fx-boot').hidden)
  await pet.waitForFunction(() => document.querySelector('.fx-firefly'))
  assert.ok(await pet.locator('.fx-shooting-star').count())
  assert.ok(await pet.locator('.fx-star').count())
  await pet.screenshot({ path: path.join(output, 'vfx-night.png') })

  await settings.locator('#vfxNight').uncheck()
  await pet.waitForFunction(() => !document.querySelector('.fx-firefly'))
  await settings.locator('#vfxNight').check()
  await settings.locator('#vfxAtmosphere').uncheck()
  await pet.waitForFunction(() => !document.querySelector('.fx-dust') && !document.querySelector('#scene').classList.contains('fx-clouds-on'))
  await settings.locator('#vfxAtmosphere').check()
  await pet.evaluate(() => effects.environment({ hour: 12, kind: 'clear', month: 9 }))
  assert.ok(await pet.locator('.fx-leaf').count())
  assert.ok(await pet.locator('.fx-dust').count())
  assert.equal(await pet.locator('.fx-firefly').count(), 0)
  await pet.evaluate(() => effects.environment({ hour: 12, kind: 'rain', month: 9 }))
  assert.equal(await pet.locator('.fx-dust').count(), 0)
  await pet.evaluate(() => effects.environment({ hour: 22, kind: 'clear', month: 9 }))

  await settings.locator('#preview-boot').click()
  await pet.waitForFunction(() => !document.querySelector('.fx-boot').hidden)
  await event('UserPromptSubmit')
  await pet.waitForFunction(() => document.querySelector('.fx-boot').hidden && document.querySelector('#label').textContent.includes('Thinking'))
  assert.ok(await pet.locator('.fx-work-spark').count())
  await settings.locator('#vfxActivity').uncheck()
  await pet.waitForFunction(() => !document.querySelector('.fx-work-spark'))
  await settings.locator('#vfxActivity').check()
  await event('Stop')
  await pet.waitForFunction(() => document.querySelector('.fx-celebration .sp'))
  await settings.locator('#vfxCelebration').uncheck()
  await pet.waitForFunction(() => !document.querySelector('.sp') && !document.querySelector('.card').classList.contains('shimmer'))
  await settings.locator('#vfxCelebration').check()

  await settings.locator('#vfxScanlines').check()
  await pet.waitForFunction(() => !document.querySelector('.fx-scanlines').hidden)
  await settings.locator('#vfxIntensity').fill('80')
  await settings.locator('#vfxIntensity').dispatchEvent('change')
  await settings.locator('#vfx').uncheck()
  await pet.waitForFunction(() => !document.querySelector('.fx-firefly') && document.querySelector('.fx-scanlines').hidden)
  assert.equal(await settings.locator('#vfxNight').isDisabled(), true)
  await settings.locator('#vfx').check()
  await settings.locator('#compact').check()
  await pet.waitForFunction(() => !document.querySelector('.fx-firefly'))
  await settings.locator('#compact').uncheck()
  await pet.emulateMedia({ reducedMotion: 'reduce' })
  await pet.waitForFunction(() => !document.querySelector('.fx-firefly') && !document.querySelector('.fx-dust'))
  await settings.locator('#preview-boot').click()
  assert.equal(await pet.evaluate(() => document.querySelector('.fx-boot').hidden), true)
  await pet.emulateMedia({ reducedMotion: 'no-preference' })
  await pet.waitForFunction(() => !!document.querySelector('.fx-firefly'))
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('/index.html')).hide())
  await pet.waitForFunction(() => document.querySelector('#scene').classList.contains('fx-paused') && !document.querySelector('.fx-firefly'))
  assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('/index.html')).isVisible()), false)
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('/index.html')).showInactive())
  await pet.waitForFunction(() => !document.querySelector('#scene').classList.contains('fx-paused') && !!document.querySelector('.fx-firefly'))

  await settings.locator('#bootSequence').uncheck()
  await settings.locator('#vfxNight').uncheck()
  const cssKey = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(w => w.webContents.getURL().endsWith('/settings.html')).webContents.insertCSS('footer { position: static !important; } main { padding-bottom: 0 !important; }'))
  await settings.screenshot({ path: path.join(output, 'settings-vfx.png'), fullPage: true })
  await app.evaluate(({ BrowserWindow }, key) => BrowserWindow.getAllWindows().find(w => w.webContents.getURL().endsWith('/settings.html')).webContents.removeInsertedCSS(key), cssKey)
  await app.close()
  app = null
  ;({ settings, pet } = await launch())
  assert.equal(await settings.locator('#bootSequence').isChecked(), false)
  assert.equal(await settings.locator('#vfxNight').isChecked(), false)
  assert.equal(await settings.locator('#vfxIntensity').inputValue(), '80')
  assert.equal(await settings.locator('#vfxScanlines').isChecked(), true)
  assert.equal(await pet.evaluate(() => document.querySelector('.fx-boot').hidden), true)
  assert.equal(await pet.locator('.fx-firefly').count(), 0)
  assert.deepEqual(errors, [])
  console.log('VFX smoke passed: boot, live interruption, effect toggles, seasons, intensity, compact mode, reduced motion, hidden window and restart persistence.')
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(async () => {
  if (app) await app.close()
  fs.rmSync(dir, { recursive: true, force: true })
})
