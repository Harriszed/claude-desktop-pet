const byId = id => document.getElementById(id)
const effectToggles = ['vfxNight', 'vfxAtmosphere', 'vfxActivity', 'vfxCelebration', 'vfxScanlines', 'bootSequence']
const toggles = ['compact', 'alwaysOnTop', 'hideFullscreen', 'chatter', 'weather', 'sound', 'startup', 'vfx', ...effectToggles]
let data
const feedback = (message, error = false) => { byId('feedback').textContent = message; byId('feedback').classList.toggle('error', error) }
function render(value) {
  data = value
  byId('version').textContent = `v${value.version}`
  for (const key of toggles) byId(key).checked = !!value[key]
  byId('scale').value = String(value.scale)
  byId('usageRefreshMinutes').value = String(value.usageRefreshMinutes)
  byId('soundVolume').value = value.soundVolume
  byId('volume-label').textContent = `${value.soundVolume}%`
  byId('soundVolume').disabled = !value.sound
  for (const key of effectToggles) byId(key).disabled = !value.vfx
  byId('vfxIntensity').value = value.vfxIntensity
  byId('intensity-label').textContent = `${value.vfxIntensity}%`
  byId('vfxIntensity').disabled = !value.vfx
  byId('preview-boot').disabled = !value.vfx || !value.bootSequence || value.compact
  byId('hideFullscreen').disabled = !value.capabilities.fullscreen
  byId('platform-note').hidden = !value.capabilities.note
  byId('platform-note').textContent = value.capabilities.note
  byId('connection-status').textContent = value.connected ? 'Connected. Your pet is listening.' : 'Connect Claude Code to bring your pet to life.'
  byId('connect').textContent = value.connected ? 'Repair connection' : 'Connect Claude Code'
  byId('disconnect').hidden = !value.connected
  const connection = value.connectionTest
  byId('test-connection').textContent = connection.phase === 'testing' ? 'Testing…' : 'Test connection'
  byId('test-connection').disabled = connection.phase === 'testing'
  byId('connect').disabled = connection.phase === 'testing'
  byId('disconnect').disabled = connection.phase === 'testing'
  byId('connection-test-status').hidden = !connection.message
  byId('connection-test-status').textContent = connection.message
  byId('connection-test-status').classList.toggle('error', connection.phase === 'failed')
  byId('update-status').textContent = value.update.message
  const phase = value.update.phase
  byId('check-updates').textContent = phase === 'available' ? value.update.automaticInstall ? 'Download update' : 'View release' : phase === 'downloaded' ? 'Restart and install' : phase === 'checking' ? 'Checking…' : phase === 'downloading' ? 'Downloading…' : phase === 'installing' ? 'Installing…' : 'Check for updates'
  byId('check-updates').disabled = ['checking', 'downloading', 'installing'].includes(phase)
  byId('check-updates').classList.toggle('primary', phase === 'downloaded' || phase === 'available' && value.update.automaticInstall)
}
async function save(patch) {
  try { render(await window.settings.set(patch)); feedback('Saved.') }
  catch (error) { if (data) render(data); feedback(`Could not save: ${error.message}`, true) }
}
for (const key of toggles) byId(key).addEventListener('change', event => save({ [key]: event.target.checked }))
byId('scale').addEventListener('change', event => save({ scale: Number(event.target.value) }))
byId('usageRefreshMinutes').addEventListener('change', event => save({ usageRefreshMinutes: Number(event.target.value) }))
byId('soundVolume').addEventListener('input', event => { byId('volume-label').textContent = `${event.target.value}%` })
byId('soundVolume').addEventListener('change', event => save({ soundVolume: Number(event.target.value) }))
byId('vfxIntensity').addEventListener('input', event => { byId('intensity-label').textContent = `${event.target.value}%` })
byId('vfxIntensity').addEventListener('change', event => save({ vfxIntensity: Number(event.target.value) }))
async function action(id, run, message) {
  const button = byId(id)
  button.disabled = true
  try { const result = await run(); if (message) feedback(typeof message === 'function' ? message(result) : message) }
  catch (error) { feedback(`${error.message}. Please try again.`, true) }
  finally { if (id === 'check-updates' && data) render(data); else button.disabled = false }
}
byId('connect').onclick = () => action('connect', () => window.settings.connect(false), result => result.usageEnabled ? 'Connected. Restart open Claude Code sessions.' : 'Connected. Your existing status line was kept; the usage readout is off. Restart open Claude Code sessions.')
byId('disconnect').onclick = () => action('disconnect', () => window.settings.connect(true), 'Disconnected. Restart open Claude Code sessions before uninstalling the pet.')
byId('test-connection').onclick = () => action('test-connection', async () => render({ ...data, connectionTest: await window.settings.testConnection() }))
byId('move').onclick = () => action('move', () => window.settings.snap(byId('corner').value), 'Pet moved.')
byId('test-sound').onclick = () => action('test-sound', () => window.settings.testSound(), 'Playing the chime at your chosen volume.')
byId('preview-boot').onclick = () => action('preview-boot', () => window.settings.previewBoot(), 'Preview plays while the pet is idle and reduced motion is off.')
byId('check-updates').onclick = () => action('check-updates', async () => render({ ...data, update: await window.settings.checkUpdates() }))
byId('releases').onclick = () => action('releases', () => window.settings.openReleases())
window.settings.onChange(render)
window.settings.get().then(render).catch(error => feedback(`Could not load settings: ${error.message}. Close and reopen Settings.`, true))
