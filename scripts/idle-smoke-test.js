// Exercise real idle playback, walking and live work in isolated Electron data.
const { _electron: electron } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('fs'), os = require('os'), path = require('path')
const root = path.join(__dirname, '..'), catalog = require('../animation-catalog')
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pet-idle-check-'))
const env = { ...process.env, PET_TEST_DATA: dir, PET_TEST_PORT: '47938', PET_TEST_CLAUDE_SETTINGS: path.join(dir, 'claude.json') }
delete env.ELECTRON_RUN_AS_NODE
fs.writeFileSync(path.join(dir, 'window.json'), JSON.stringify({ setupShown: true, updateCheckedAt: Date.now(), weatherOff: true, hideFullscreen: false, bootSequence: false, chatterOff: true, vfx: false }))
let app
async function main() {
  const packaged = process.argv.includes('--packaged')
  app = await electron.launch({ executablePath: packaged ? path.join(root, 'dist', 'win-unpacked', 'Claude Desktop Pet.exe') : undefined, args: packaged ? [] : [root], env })
  const pet = await app.firstWindow()
  await pet.waitForSelector('#char')
  assert.deepEqual(await pet.evaluate(() => window.PET_ANIMATIONS.idleVariants), ['idle', 'idle-look-around', 'idle-breathe'])
  assert.equal(await pet.evaluate(() => window.PET_ANIMATIONS.states.walking.sourceTag), 'v1.6.0')
  await pet.evaluate(() => {
    Math.random = () => 0
    clearTimeout(walkTimer); walkTimer = 0; state = 'idle'; lastWalk = Date.now() + 120000
    show('idle')
  })
  await pet.waitForFunction(() => document.querySelector('#char').src.includes('idle-look-around.svg'), null, { timeout: catalog.states.idle.duration * 1000 + 2500 })
  await pet.evaluate(() => { Math.random = () => .99 })
  await pet.waitForFunction(() => document.querySelector('#char').src.includes('idle-breathe.svg'), null, { timeout: catalog.states['idle-look-around'].duration * 1000 + 2500 })
  // The walk takes priority, then settles into a different idle choice.
  await pet.evaluate(() => { Math.random = () => 0; walkTo(x > 180 ? 120 : 240) })
  assert.ok(await pet.locator('#char').evaluate(img => img.src.includes('walking.svg')))
  await pet.waitForFunction(() => !walkTimer, null, { timeout: 4000 })
  assert.ok(await pet.locator('#char').evaluate(img => img.src.includes('idle.svg')))
  await pet.evaluate(() => { lastWalk = Date.now() + 120000; show('idle-breathe') })
  await fetch('http://127.0.0.1:47938/event', { method: 'POST', body: JSON.stringify({ event: 'UserPromptSubmit', session: 'idle-check', cwd: 'C:\\Demo' }) })
  await pet.waitForFunction(() => document.querySelector('#char').src.includes('thinking.svg'))
  await new Promise(resolve => setTimeout(resolve, catalog.states['idle-breathe'].duration * 1000 + 300))
  assert.ok(await pet.locator('#char').evaluate(img => img.src.includes('thinking.svg')), 'work cancels the old idle timer')
  await pet.emulateMedia({ reducedMotion: 'reduce' })
  await pet.evaluate(() => { setState('idle'); lastWalk = Date.now() + 120000 })
  const still = await pet.locator('#char').getAttribute('src')
  const name = catalog.idleVariants.find(name => still.includes('/' + name + '.svg'))
  await new Promise(resolve => setTimeout(resolve, catalog.states[name].duration * 1000 + 300))
  assert.equal(await pet.locator('#char').getAttribute('src'), still, 'reduced motion stops random idle switching')
  console.log(`${packaged ? 'Packaged' : 'Source'} idle smoke passed: all three choices, earlier walk, natural loop switching, no immediate repeats, live work interruption and reduced motion.`)
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(async () => {
  if (app) await app.close()
  fs.rmSync(dir, { recursive: true, force: true })
})
