// Background refreshes must keep the existing cloud/star animation timelines.
const { _electron: electron } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('fs'), path = require('path'), os = require('os')
const root = path.join(__dirname, '..'), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pet-backdrop-'))
const env = { ...process.env, PET_TEST_DATA: dir, PET_TEST_PORT: '47937', PET_TEST_CLAUDE_SETTINGS: path.join(dir, 'claude.json'), PET_HOUR: '12' }
delete env.ELECTRON_RUN_AS_NODE
fs.writeFileSync(path.join(dir, 'window.json'), JSON.stringify({ setupShown: true, bootSequence: false, updateCheckedAt: Date.now(), weatherOff: true, hideFullscreen: false, chatterOff: true }))
const packaged = process.argv.includes('--packaged')
let app
async function main() {
  app = await electron.launch({ executablePath: packaged ? path.join(root, 'dist', 'win-unpacked', 'Claude Desktop Pet.exe') : undefined, args: packaged ? [] : [root], env })
  const pet = await app.firstWindow()
  await pet.waitForFunction(() => document.querySelector('.fx-cloud')?.getAnimations().length > 0)
  const result = await pet.evaluate(() => {
    const cloud = document.querySelector('.fx-cloud'), animation = cloud.getAnimations()[0]
    animation.pause(); animation.currentTime = 40000
    const before = getComputedStyle(cloud).transform
    drawBackdrop()
    const next = document.querySelector('.fx-cloud')
    return { sameNode: next === cloud, sameAnimation: next.getAnimations()[0] === animation, before, after: getComputedStyle(next).transform }
  })
  console.log(result)
  assert.equal(result.sameNode, true, 'minute refresh retains cloud nodes')
  assert.equal(result.sameAnimation, true, 'minute refresh retains animation timelines')
  assert.equal(result.after, result.before, 'minute refresh does not jump the cloud position')
  await pet.evaluate(() => {
    window.backdropTestCloud = document.querySelector('.fx-cloud')
    window.backdropTestAnimation = window.backdropTestCloud.getAnimations()[0]
    window.backdropTestTransform = getComputedStyle(window.backdropTestCloud).transform
    window.backdropTestFill = window.backdropTestCloud.firstElementChild.getAttribute('fill')
    setWeather('clear')
  })
  assert.equal(await pet.evaluate(() => document.querySelector('.fx-cloud') === window.backdropTestCloud), true, 'same weather keeps cloud identity')
  await pet.evaluate(() => setWeather('cloudy'))
  assert.equal(await pet.locator('.fx-cloud').count(), 7)
  assert.equal(await pet.evaluate(() => document.querySelector('.fx-cloud').getAnimations()[0] === window.backdropTestAnimation), true, 'weather changes preserve shared cloud timelines')
  assert.equal(await pet.evaluate(() => getComputedStyle(document.querySelector('.fx-cloud')).transform === window.backdropTestTransform), true)
  assert.notEqual(await pet.evaluate(() => document.querySelector('.fx-cloud').firstElementChild.getAttribute('fill')), await pet.evaluate(() => window.backdropTestFill), 'weather still updates cloud colours')
  await pet.evaluate(() => effects.setVisible(false))
  assert.equal(await pet.evaluate(() => getComputedStyle(document.querySelector('.fx-cloud')).animationPlayState), 'paused')
  assert.equal(await pet.evaluate(() => document.querySelector('.fx-cloud').getAnimations()[0] === window.backdropTestAnimation), true, 'hiding pauses rather than discarding cloud animation')
  await pet.evaluate(() => effects.setVisible(true))
  assert.equal(await pet.evaluate(() => document.querySelector('.fx-cloud').getAnimations()[0] === window.backdropTestAnimation), true, 'showing resumes the existing timeline')
  await pet.evaluate(() => {
    history.replaceState(null, '', '?hour=22')
    setWeather('clear')
    window.backdropTestStar = document.querySelector('.fx-star')
    window.backdropTestStarAnimation = window.backdropTestStar.getAnimations()[0]
    drawBackdrop()
  })
  assert.equal(await pet.evaluate(() => document.querySelector('.fx-star') === window.backdropTestStar), true)
  assert.equal(await pet.evaluate(() => document.querySelector('.fx-star').getAnimations()[0] === window.backdropTestStarAnimation), true, 'star twinkles also survive refreshes')
  console.log('Backdrop smoke passed: refresh continuity, weather colours/cloud counts, hide/show pausing and star timelines.')
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(async () => {
  if (app) await app.close()
  fs.rmSync(dir, { recursive: true, force: true })
})
