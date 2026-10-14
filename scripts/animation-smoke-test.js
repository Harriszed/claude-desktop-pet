// Validate every imported pose transition and preview the set in the real Electron renderer.
const { _electron: electron } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto')
const { pathToFileURL } = require('url')
const root = path.join(__dirname, '..'), catalog = require('../animation-catalog')
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pet-animation-check-'))
const env = { ...process.env, PET_TEST_DATA: dir, PET_TEST_PORT: '47936', PET_TEST_CLAUDE_SETTINGS: path.join(dir, 'claude.json') }
delete env.ELECTRON_RUN_AS_NODE
fs.writeFileSync(path.join(dir, 'window.json'), JSON.stringify({ setupShown: true, updateCheckedAt: Date.now(), weatherOff: true, hideFullscreen: false, bootSequence: false, chatterOff: true }))
let app
async function main() {
  const output = path.join(root, 'output', 'animations')
  fs.mkdirSync(output, { recursive: true })
  const packaged = process.argv.includes('--packaged')
  app = await electron.launch({ executablePath: packaged ? path.join(root, 'dist', 'win-unpacked', 'Claude Desktop Pet.exe') : undefined, args: packaged ? [] : [root], env })
  const pet = await app.firstWindow()
  await pet.waitForSelector('#char')
  assert.equal(await pet.evaluate(() => window.PET_ANIMATIONS.version), catalog.version)
  assert.equal(await pet.evaluate(() => window.PET_ANIMATIONS.commit), catalog.commit)
  const assetsRoot = path.join(await app.evaluate(({ app }) => app.getAppPath()), 'assets')
  const newWindow = app.waitForEvent('window')
  const id = await app.evaluate(({ BrowserWindow }, file) => {
    const window = new BrowserWindow({ show: false, width: 240, height: 220, frame: false, webPreferences: { sandbox: true, backgroundThrottling: false } })
    global.animationSmokeWindow = window
    window.loadFile(file)
    return window.id
  }, path.join(assetsRoot, 'idle.svg'))
  const svg = await newWindow
  let transitions = 0
  for (const [state, info] of Object.entries(catalog.states)) {
    const bytes = fs.readFileSync(path.join(root, 'assets', info.file))
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), info.sha256, `${state} matches the catalog export`)
    const appHash = await app.evaluate(({ app }, file) => process.getBuiltinModule('crypto').createHash('sha256').update(process.getBuiltinModule('fs').readFileSync(app.getAppPath() + '/assets/' + file)).digest('hex'), info.file)
    assert.equal(appHash, info.sha256, `${state} is bundled unchanged`)
    await svg.goto(pathToFileURL(path.join(assetsRoot, info.file)).href)
    const result = await svg.evaluate(({ state, sourceState, duration, loop }) => {
      const root = document.documentElement
      if (root.getAttribute('data-state') !== sourceState) throw new Error('Wrong source state')
      if (root.getAttribute('viewBox') !== '-20 -40 240 220') throw new Error('Unexpected canvas')
      if (document.querySelector('script, image, foreignObject')) throw new Error('Animation must be a standalone vector asset')
      const frames = [...document.querySelectorAll('.cm-frame')]
      if (state === 'directing-helpers') {
        for (const frame of frames) {
          const coral = [...frame.querySelectorAll('rect')].filter(rect => rect.getAttribute('fill').includes('--cm-color'))
          const bodies = coral.filter(rect => rect.getAttribute('width') === '85' && rect.getAttribute('height') === '65')
          if (bodies.length !== 1 || bodies[0].getAttribute('x') !== '55' || ![70, 75].includes(Number(bodies[0].getAttribute('y')))) throw new Error('Delegating actor must stay full-size with a stable anchor')
          if (coral.some(rect => rect.getAttribute('width') === '25' && rect.getAttribute('height') === '20')) throw new Error('No miniature Claudes in the delegation scene')
          if (coral.filter(rect => rect.getAttribute('width') === '11' && rect.getAttribute('height') === '26' && rect.getAttribute('y') === '130').length !== 4) throw new Error('Delegating feet must remain planted')
          for (const rect of frame.querySelectorAll('rect')) {
            const x = Number(rect.getAttribute('x')), y = Number(rect.getAttribute('y'))
            if (x < -20 || y < -40 || x + Number(rect.getAttribute('width')) > 220 || y + Number(rect.getAttribute('height')) > 180) throw new Error('Delegation prop is clipped')
          }
        }
      }
      const animations = root.getAnimations({ subtree: true })
      if (!animations.length) throw new Error('No animated frames')
      for (const animation of animations) {
        animation.pause()
        const timing = animation.effect.getComputedTiming()
        if (Math.abs(timing.duration - duration * 1000) > .1 || timing.iterations !== (loop ? Infinity : 1)) throw new Error('Wrong duration or loop behavior')
      }
      const boundaries = [...new Set(animations.flatMap(a => a.effect.getKeyframes().map(f => f.offset * duration * 1000)))]
      const times = [0, duration * 1000 - .5, ...boundaries.flatMap(t => [t - .5, t + .5]).filter(t => t >= 0 && t < duration * 1000)]
      if (!loop) times.push(duration * 1000 + 500)
      for (const time of times) {
        animations.forEach(a => { a.currentTime = time })
        const visible = frames.filter(f => Number(getComputedStyle(f).opacity) > .99)
        if (visible.length !== 1) throw new Error(`At ${time.toFixed(2)}ms, ${visible.length} frames are visible`)
      }
      animations.forEach(a => { a.currentTime = duration * 1000 * .55 })
      return times.length
    }, { ...info, state })
    transitions += result
    if (!packaged && state === 'directing-helpers') {
      const poses = await svg.evaluate(() => [...document.querySelectorAll('.cm-frame')].map(frame => frame.innerHTML))
      const html = `<html><style>body{margin:0;padding:20px;background:#1f1d1b;color:#e8e2da;font:12px Segoe UI;display:grid;grid-template-columns:repeat(5,160px);gap:10px}figure{margin:0;background:#292623;text-align:center}svg{width:160px;height:147px}figcaption{padding:5px}</style>${poses.map((pose, i) => `<figure><svg viewBox="-20 -40 240 220" shape-rendering="crispEdges">${pose}</svg><figcaption>Pose ${i + 1}</figcaption></figure>`).join('')}</html>`
      fs.writeFileSync(path.join(output, 'delegating-poses.html'), html)
    }
    if (!packaged) await svg.screenshot({ path: path.join(output, `${state}.png`), omitBackground: true })
    await svg.emulateMedia({ reducedMotion: 'reduce' })
    assert.equal(await svg.evaluate(() => [...document.querySelectorAll('.cm-frame')].filter(f => Number(getComputedStyle(f).opacity) > .99).length), 1, `${state} has one reduced-motion pose`)
    await svg.emulateMedia({ reducedMotion: 'no-preference' })
    await pet.evaluate(state => show(state), state)
    await pet.waitForFunction(file => { const img = document.querySelector('#char'); return img.complete && img.naturalWidth === 240 && img.src.includes(file) }, info.file)
  }
  if (!packaged) {
    await svg.goto(pathToFileURL(path.join(output, 'delegating-poses.html')).href)
    await svg.screenshot({ path: path.join(output, 'delegating-poses.png'), fullPage: true })
  }
  for (const gags of packaged ? [] : [false, true]) {
    const states = Object.keys(catalog.states).filter(id => id.startsWith('gag-') === gags)
    const html = `<html><style>body{margin:0;padding:22px;background:#1f1d1b;color:#e8e2da;font:12px Segoe UI,sans-serif;display:grid;grid-template-columns:repeat(4,180px);gap:12px}figure{margin:0;background:#292623;padding:8px;text-align:center}img{width:160px;height:147px;image-rendering:pixelated}figcaption{padding:6px}</style>${states.map(id => `<figure><img src="${id}.png"><figcaption>${id}</figcaption></figure>`).join('')}</html>`
    const name = gags ? 'gag-preview' : 'activity-preview'
    fs.writeFileSync(path.join(output, `${name}.html`), html)
    await app.evaluate(({ BrowserWindow }, id) => BrowserWindow.fromId(id).setContentSize(800, 240), id)
    await svg.goto(pathToFileURL(path.join(output, `${name}.html`)).href)
    await svg.screenshot({ path: path.join(output, `${name}.png`), fullPage: true })
  }
  // The longest gag must still be running when the previous short gag timer expired.
  const [longestGag, longestInfo] = Object.entries(catalog.states).filter(([id]) => id.startsWith('gag-')).sort((a, b) => b[1].duration - a[1].duration)[0]
  await pet.evaluate(longestGag => {
    clearTimeout(walkTimer); walkTimer = 0; state = 'idle'; lastGag = -1
    const random = Math.random
    const index = GAGS.findIndex(([name]) => 'gag-' + name === longestGag)
    if (index < 0) throw new Error('Longest gag is missing from the app')
    Math.random = () => (index + .5) / GAGS.length
    try { playGag() } finally { Math.random = random }
  }, longestGag)
  await new Promise(resolve => setTimeout(resolve, 5500))
  assert.ok(await pet.evaluate(file => document.querySelector('#char').src.includes(file), longestInfo.file))
  await pet.waitForFunction(() => window.PET_ANIMATIONS.idleVariants.some(id => document.querySelector('#char').src.includes('/' + id + '.svg')), null, { timeout: longestInfo.duration * 1000 + 2000 })
  await pet.evaluate(() => {
    lastGag = -1
    const random = Math.random
    Math.random = () => 0
    try { playGag() } finally { Math.random = random }
  })
  await fetch('http://127.0.0.1:47936/event', { method: 'POST', body: JSON.stringify({ event: 'UserPromptSubmit', session: 'animation-test', cwd: 'C:\\Demo' }) })
  await pet.waitForFunction(() => document.querySelector('#char').src.includes('thinking.svg'), null, { timeout: 5000 })
  assert.equal(await pet.evaluate(() => walkTimer), 0, 'incoming work cancels the long gag timer')
  console.log(`Animation smoke passed: ${Object.keys(catalog.states).length} catalog SVGs (base v${catalog.version}), ${transitions} pose/loop checks, full-size delegation, reduced motion, app loading and complete longest gag.`)
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(async () => {
  if (app) await app.close()
  fs.rmSync(dir, { recursive: true, force: true })
})
