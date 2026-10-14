// Record setup against temporary Claude settings, never the user's connection.
const { _electron: electron } = require('playwright')
const fs = require('fs'), path = require('path'), os = require('os')
const { execFileSync } = require('child_process')
const root = path.join(__dirname, '..'), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pet-settings-media-'))
const output = path.join(root, 'output', 'settings-media')
fs.mkdirSync(output, { recursive: true })
const env = { ...process.env, PET_TEST_DATA: dir, PET_TEST_PORT: '47941', PET_TEST_CLAUDE_SETTINGS: path.join(dir, 'claude.json'), PET_OPEN_SETTINGS: '1' }
delete env.ELECTRON_RUN_AS_NODE
fs.writeFileSync(path.join(dir, 'window.json'), JSON.stringify({ setupShown: true, startupSet: true, updateCheckedAt: Date.now(), weatherOff: true, hideFullscreen: false, bootSequence: false }))
fs.writeFileSync(env.PET_TEST_CLAUDE_SETTINGS, '{}')
let app
async function main() {
  app = await electron.launch({ executablePath: path.join(root, 'dist', 'win-unpacked', 'Claude Desktop Pet.exe'), args: [], env })
  await app.firstWindow()
  let settings
  for (let i = 0; i < 50; i++) {
    settings = app.windows().find(page => page.url().endsWith('/settings.html'))
    if (settings) break
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  await settings.waitForSelector('#usageRefreshMinutes')
  const key = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(w => w.webContents.getURL().endsWith('/settings.html')).webContents.insertCSS('footer{position:static!important} main{padding-bottom:0!important}'))
  await settings.screenshot({ path: path.join(root, 'docs', 'settings.png'), fullPage: true })
  await app.evaluate(({ BrowserWindow }, key) => BrowserWindow.getAllWindows().find(w => w.webContents.getURL().endsWith('/settings.html')).webContents.removeInsertedCSS(key), key)
  const capture = name => settings.screenshot({ path: path.join(output, name), clip: { x: 0, y: 0, width: 600, height: 410 } })
  await capture('before.png')
  await settings.locator('#connect').click()
  await settings.waitForFunction(() => document.querySelector('#connection-status').textContent.startsWith('Connected.'))
  await capture('connected.png')
  await settings.locator('#test-connection').click()
  await settings.waitForFunction(() => document.querySelector('#connection-test-status').textContent.startsWith('Test passed.'))
  await capture('tested.png')
  await app.close(); app = null
  fs.writeFileSync(path.join(output, 'frames.txt'), "file 'before.png'\nduration 3\nfile 'connected.png'\nduration 3\nfile 'tested.png'\nduration 3\nfile 'tested.png'\n")
  execFileSync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', path.join(output, 'frames.txt'), '-filter_complex', '[0:v]fps=4,split[a][b];[a]palettegen[p];[b][p]paletteuse=dither=bayer', '-loop', '0', path.join(root, 'docs', 'setup.gif')], { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true })
  console.log('Captured clean v1.4.0 Settings and connection/setup GIF using temporary hooks.')
}
main().catch(error => { console.error(error.message); process.exitCode = 1 }).finally(async () => {
  if (app) await app.close()
  fs.rmSync(dir, { recursive: true, force: true })
})
