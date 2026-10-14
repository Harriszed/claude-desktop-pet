// Capture the real Electron UI with isolated, fictional demo sessions.
const { _electron: electron } = require('playwright')
const fs = require('fs'), path = require('path'), os = require('os')
const { execFileSync } = require('child_process')
const root = path.join(__dirname, '..'), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pet-release-media-'))
const output = path.join(root, 'output', 'release-media'), docs = path.join(root, 'docs')
fs.mkdirSync(output, { recursive: true })
const env = { ...process.env, PET_TEST_DATA: dir, PET_TEST_PORT: '47939', PET_TEST_CLAUDE_SETTINGS: path.join(dir, 'claude.json'), PET_HOUR: '12' }
delete env.ELECTRON_RUN_AS_NODE
fs.writeFileSync(path.join(dir, 'window.json'), JSON.stringify({ setupShown: true, updateCheckedAt: Date.now(), weatherOff: true, hideFullscreen: false, bootSequence: false, chatterOff: true }))
let app, pet, frame = 0
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
const event = value => fetch('http://127.0.0.1:47939/event', { method: 'POST', body: JSON.stringify(value) })
async function resize() {
  const height = await pet.evaluate(() => document.body.classList.contains('deep') ? 260 : 176)
  await app.evaluate(({ BrowserWindow }, height) => {
    const win = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('/index.html'))
    win.setResizable(true)
    win.webContents.setZoomFactor(2)
    win.setBounds({ x: 80, y: 80, width: 680, height: height * 2 })
  }, height)
  await wait(200)
}
async function capture(file) {
  const bytes = await app.evaluate(async ({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('/index.html'))
    return (await win.webContents.capturePage()).toPNG().toString('base64')
  })
  fs.writeFileSync(file, Buffer.from(bytes, 'base64'))
}
async function snap(name) { await resize(); await capture(path.join(docs, name)) }
async function record(seconds) {
  const start = Date.now()
  for (let i = 0; i < seconds * 10; i++) {
    await capture(path.join(output, `frame-${String(frame++).padStart(4, '0')}.png`))
    await wait(Math.max(0, start + (i + 1) * 100 - Date.now()))
  }
}
async function main() {
  app = await electron.launch({ args: [root], env })
  pet = await app.firstWindow()
  await pet.waitForSelector('#char')
  await wait(1000) // Let the initial scene settle before adding demo sessions.
  await event({ event: 'UserPromptSubmit', session: 'demo-pet', cwd: 'C:\\Projects\\desktop-pet' })
  await event({ event: 'PreToolUse', session: 'demo-pet', tool: 'TodoWrite', todos: [
    { s: 'completed', c: 'Refresh animations' }, { s: 'completed', c: 'Polish effects' },
    { s: 'in_progress', c: 'Prepare release' }, { s: 'pending', c: 'Publish builds' },
  ] })
  await event({ event: 'PreToolUse', session: 'demo-pet', tool: 'Task', detail: 'Review the visuals' })
  await event({ event: 'UserPromptSubmit', session: 'demo-docs', cwd: 'C:\\Projects\\docs-site' })
  await event({ event: 'SubagentStart', session: 'demo-pet', agent: 'demo-reader' })
  await event({ event: 'PreToolUse', session: 'demo-pet', agent: 'demo-reader', tool: 'Read', detail: 'theme.css' })
  await event({ event: 'SubagentStart', session: 'demo-pet', agent: 'demo-tester' })
  await event({ event: 'PreToolUse', session: 'demo-pet', agent: 'demo-tester', tool: 'Bash', command: 'npm test', detail: 'npm test' })
  const resets = new Date(Date.now() + 3 * 3600000).toISOString()
  await fetch('http://127.0.0.1:47939/usage', { method: 'POST', body: JSON.stringify({ five: { used_percentage: 28, resets_at: resets }, seven: { used_percentage: 46, resets_at: new Date(Date.now() + 3 * 86400000).toISOString() } }) })
  await pet.waitForSelector('.helper')
  await pet.waitForFunction(() => document.querySelector('#char').src.includes('directing-helpers.svg'))
  await wait(1500); await resize()
  await pet.evaluate(() => { setWeather('clear'); show('directing-helpers') })
  await wait(2600)
  await snap('multi.png'); await snap('hero.png')
  await record(7)
  await pet.evaluate(() => { history.replaceState(null, '', '?hour=22') })
  await pet.evaluate(() => { drawBackdrop(); buildWx(); updateEffectsEnvironment(); show('directing-helpers') })
  await wait(2600)
  await snap('night.png')
  await record(7)
  for (const id of ['demo-pet', 'demo-docs']) await event({ event: 'SessionEnd', session: id })
  await pet.waitForFunction(() => !document.body.classList.contains('deep'))
  await resize()
  await pet.evaluate(() => { setState('asleep'); effects.onState('asleep'); meta.action = ''; renderBubble() })
  await wait(1600)
  await snap('sleep.png')
  await pet.evaluate(() => { history.replaceState(null, '', '?hour=12'); setWeather('rain') })
  await wait(1000)
  await snap('weather.png')
  await pet.evaluate(() => { setWeather('snow') })
  await wait(1000)
  await snap('snow.png')
  await app.close(); app = null
  const args = ['-y', '-framerate', '10', '-i', path.join(output, 'frame-%04d.png')]
  execFileSync('ffmpeg', [...args, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-crf', '19', path.join(docs, 'promo.mp4')], { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true })
  execFileSync('ffmpeg', [...args, '-filter_complex', '[0:v]split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3', '-loop', '0', path.join(docs, 'promo.gif')], { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true })
  console.log('Captured current day/night, helpers, usage, sleeping, rain/snow and a 14-second real-app recording with demo sessions.')
}
main().catch(error => { console.error(error.message); process.exitCode = 1 }).finally(async () => {
  if (app) await app.close()
  fs.rmSync(dir, { recursive: true, force: true })
})
