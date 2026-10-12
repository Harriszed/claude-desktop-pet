const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs'), os = require('os'), path = require('path')
const { createStartup } = require('../platform')
test('packaged Windows login entry launches the app without an asar argument', () => {
  let written
  const app = { isPackaged: true, setLoginItemSettings: value => { written = value }, getLoginItemSettings: () => ({ openAtLogin: false }) }
  const startup = createStartup(app, { platform: 'win32', executable: 'C:\\My Pet\\Pet.exe' })
  startup.set(true)
  assert.equal(written.path, '"C:\\My Pet\\Pet.exe"')
  assert.deepEqual(written.args, [])
})
test('source macOS login entry includes the project folder', () => {
  let written
  const app = { isPackaged: false, setLoginItemSettings: value => { written = value } }
  createStartup(app, { platform: 'darwin', executable: '/Applications/Electron', appPath: '/Users/My Pet' }).set(true)
  assert.deepEqual(written, { openAtLogin: true, path: '/Applications/Electron', args: ['/Users/My Pet'] })
})
test('Linux autostart uses the persistent AppImage and can be removed', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pet-startup-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const startup = createStartup({ isPackaged: true }, { platform: 'linux', env: { XDG_CONFIG_HOME: dir, APPIMAGE: '/home/user/My $Pet 100%.AppImage' }, executable: '/tmp/.mount_pet/AppRun' })
  assert.equal(startup.enabled(), false)
  startup.set(true)
  assert.equal(startup.enabled(), true)
  const file = path.join(dir, 'autostart', 'claude-desktop-pet.desktop')
  const text = fs.readFileSync(file, 'utf8')
  assert.ok(text.includes('Exec="/home/user/My \\$Pet 100%%.AppImage"'))
  assert.ok(!text.includes('.mount_pet'))
  startup.set(false)
  assert.equal(startup.enabled(), false)
})
