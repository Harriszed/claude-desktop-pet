// Record the real packaged Settings connection flow, using temporary data only.
const { _electron: electron } = require('playwright')
const fs = require('fs'), path = require('path'), os = require('os')
const { execFileSync } = require('child_process')
const root = path.join(__dirname, '..')
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pet-setup-capture-'))
const frames = path.join(root, 'output', 'setup')
fs.mkdirSync(frames, { recursive: true })
const env = { ...process.env, PET_TEST_DATA: dir, PET_TEST_PORT: '47932', PET_TEST_CLAUDE_SETTINGS: path.join(dir, 'claude.json'), PET_OPEN_SETTINGS: '1' }
delete env.ELECTRON_RUN_AS_NODE
fs.writeFileSync(path.join(dir, 'window.json'), JSON.stringify({ updateCheckedAt: Date.now(), weatherOff: true, hideFullscreen: false }))
let app
async function main() {
  app = await electron.launch({ executablePath: path.join(root, 'dist', 'win-unpacked', 'Claude Desktop Pet.exe'), env })
  await app.firstWindow()
  let settings
  for (let i = 0; i < 50; i++) {
    settings = app.windows().find(page => page.url().endsWith('/settings.html'))
    if (settings) break
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  if (!settings) throw new Error('Settings did not open')
  await settings.waitForSelector('#version:has-text("1.3.0")')
  await settings.locator('#connect').hover()
  await settings.screenshot({ path: path.join(frames, '01-connect.png') })
  await settings.locator('#connect').click()
  await settings.waitForFunction(() => document.querySelector('#feedback').textContent.includes('Restart open Claude Code sessions.'))
  await settings.screenshot({ path: path.join(frames, '02-connected.png') })
  await settings.locator('#disconnect').click()
  await app.close(); app = null
  const manifest = path.join(frames, 'frames.txt')
  fs.writeFileSync(manifest, "file '01-connect.png'\nduration 2.5\nfile '02-connected.png'\nduration 3.5\nfile '02-connected.png'\n")
  execFileSync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', manifest, '-filter_complex', 'fps=4,scale=480:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse', '-loop', '0', path.join(root, 'docs', 'setup.gif')], { windowsHide: true, stdio: 'pipe' })
  console.log('Recorded docs/setup.gif from the packaged connection flow.')
}
main().catch(error => { console.error(error.message); process.exitCode = 1 }).finally(async () => {
  if (app) await app.close()
  fs.rmSync(dir, { recursive: true, force: true })
})
