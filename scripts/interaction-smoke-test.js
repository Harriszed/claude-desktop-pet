// Native Windows hit-testing catches drag regions that browser mouse events bypass.
const { _electron: electron } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('fs'), path = require('path'), os = require('os')
const { execFile } = require('child_process')
const root = path.join(__dirname, '..'), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pet-clicks-'))
const port = 47935
const env = { ...process.env, PET_TEST_DATA: dir, PET_TEST_PORT: String(port), PET_TEST_CLAUDE_SETTINGS: path.join(dir, 'claude.json') }
delete env.ELECTRON_RUN_AS_NODE
fs.writeFileSync(path.join(dir, 'window.json'), JSON.stringify({ updateCheckedAt: Date.now(), weatherOff: true, hideFullscreen: false, bootSequence: false, chatterOff: true }))
const packaged = process.argv.includes('--packaged')
const installed = process.argv.includes('--installed')
const executablePath = installed ? path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Claude Desktop Pet', 'Claude Desktop Pet.exe') : packaged ? path.join(root, 'dist', 'win-unpacked', 'Claude Desktop Pet.exe') : undefined
let app
async function nativeHit(pet, selector, expected = 1) {
  const box = await pet.locator(selector).boundingBox()
  assert.ok(box, selector)
  const point = await app.evaluate(({ BrowserWindow, screen }, box) => {
    const win = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().endsWith('/index.html'))
    const bounds = win.getContentBounds(), scale = win.webContents.getZoomFactor()
    const p = screen.dipToScreenPoint({ x: Math.round(bounds.x + (box.x + box.width / 2) * scale), y: Math.round(bounds.y + (box.y + box.height / 2) * scale) })
    return { hwnd: win.getNativeWindowHandle().readBigUInt64LE().toString(), ...p }
  }, box)
  const script = `Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class PetHit { [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr h, uint m, IntPtr w, IntPtr l); }'; [PetHit]::SendMessage([IntPtr]${point.hwnd}, 132, [IntPtr]0, [IntPtr]((${point.y} -shl 16) -bor (${point.x} -band 65535))).ToInt64()`
  const hit = await new Promise((resolve, reject) => execFile('powershell.exe', ['-NoProfile', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { windowsHide: true }, (error, stdout) => error ? reject(error) : resolve(Number(stdout.trim()))))
  console.log(`${selector}: Windows hit region ${hit}`)
  assert.equal(hit, expected, `${selector} has the correct native click/drag region`)
}
async function event(value) { await fetch(`http://127.0.0.1:${port}/event`, { method: 'POST', body: JSON.stringify(value) }) }
async function main() {
  app = await electron.launch({ executablePath, args: executablePath ? [] : [root], env })
  await app.firstWindow()
  let pet
  for (let i = 0; i < 50; i++) {
    pet = app.windows().find(page => page.url().endsWith('/index.html'))
    if (pet) break
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  assert.ok(pet, 'pet window opens')
  await pet.waitForSelector('#char')
  await app.evaluate(({ BrowserWindow, ipcMain }) => {
    const win = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().endsWith('/index.html'))
    win.setPosition(100, 100)
    win.show()
    ipcMain.removeHandler('focus-session')
    ipcMain.handle('focus-session', (_, id) => { global.clickedSession = id })
  })
  await nativeHit(pet, '#resize')
  await nativeHit(pet, '.status > b', 2)
  await nativeHit(pet, '#char')
  await pet.locator('#char').click()
  await pet.waitForFunction(() => !document.querySelector('#info').hidden)
  await nativeHit(pet, '#info')
  await pet.locator('#info').click()
  await event({ event: 'UserPromptSubmit', session: 'one', cwd: 'C:\\First' })
  await event({ event: 'UserPromptSubmit', session: 'two', cwd: 'C:\\Second' })
  await event({ event: 'SubagentStart', session: 'one', agent: 'helper-one' })
  await pet.waitForSelector('.multi span')
  await pet.waitForSelector('.helper')
  await pet.waitForFunction(() => document.querySelector('#char').src.includes('directing-helpers.svg'))
  const mainActor = await pet.locator('#char').boundingBox()
  const helperActor = await pet.locator('.helper').boundingBox()
  assert.ok(mainActor.width > helperActor.width, 'main Claude stays larger than actual helpers')
  await event({ event: 'PreToolUse', session: 'one', agent: 'helper-one', tool: 'Read', input: { file_path: 'C:\\First\\README.md' } })
  await pet.waitForFunction(() => document.querySelector('.helper').src.includes('reading.svg'))
  assert.ok(await pet.locator('#char').evaluate(img => img.src.includes('directing-helpers.svg')), 'helper activity never replaces the main delegation scene')
  await nativeHit(pet, '.multi span:first-child')
  await pet.locator('.multi span').first().click()
  assert.equal(await app.evaluate(() => global.clickedSession), 'one')
  await nativeHit(pet, '.helper')
  await pet.locator('.helper').click()
  await pet.waitForFunction(() => !document.querySelector('#info').hidden && document.querySelector('#info').textContent.includes('Spawned by the main agent'))
  await pet.locator('#info').click()
  await nativeHit(pet, '.laptop-wrap')
  await pet.locator('.laptop-wrap').click()
  await pet.waitForFunction(() => !document.querySelector('#info').hidden)
  const oldWidth = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(w => w.webContents.getURL().endsWith('/index.html')).getBounds().width)
  await pet.locator('#resize').click()
  assert.ok(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(w => w.webContents.getURL().endsWith('/index.html')).getBounds().width) < oldWidth)
  await nativeHit(pet, '.multi span:first-child')
  console.log('Interaction smoke passed: native click regions, separate main/helper animations, session selection, mascot details, helper details, laptops and resize.')
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(async () => {
  if (app) await app.close()
  fs.rmSync(dir, { recursive: true, force: true })
})
