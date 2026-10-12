const byId = id => document.getElementById(id)
const toggles = ['compact', 'alwaysOnTop', 'hideFullscreen', 'chatter', 'weather', 'sound', 'startup']
let data
const feedback = (message, error = false) => { byId('feedback').textContent = message; byId('feedback').classList.toggle('error', error) }
function render(value) {
  data = value
  byId('version').textContent = `v${value.version}`
  for (const key of toggles) byId(key).checked = !!value[key]
  byId('scale').value = String(value.scale)
  byId('soundVolume').value = value.soundVolume
  byId('volume-label').textContent = `${value.soundVolume}%`
  byId('soundVolume').disabled = !value.sound
  byId('hideFullscreen').disabled = !value.capabilities.fullscreen
  byId('platform-note').hidden = !value.capabilities.note
  byId('platform-note').textContent = value.capabilities.note
  byId('connection-status').textContent = value.connected ? 'Connected. Your pet is listening.' : 'Connect Claude Code to bring your pet to life.'
  byId('connect').textContent = value.connected ? 'Repair connection' : 'Connect Claude Code'
  byId('disconnect').hidden = !value.connected
  byId('update-status').textContent = value.update.message
  byId('check-updates').disabled = ['checking', 'downloading'].includes(value.update.phase)
  byId('install-update').hidden = value.update.phase !== 'downloaded'
}
async function save(patch) {
  try { render(await window.settings.set(patch)); feedback('Saved.') }
  catch (error) { if (data) render(data); feedback(`Could not save: ${error.message}`, true) }
}
for (const key of toggles) byId(key).addEventListener('change', event => save({ [key]: event.target.checked }))
byId('scale').addEventListener('change', event => save({ scale: Number(event.target.value) }))
byId('soundVolume').addEventListener('input', event => { byId('volume-label').textContent = `${event.target.value}%` })
byId('soundVolume').addEventListener('change', event => save({ soundVolume: Number(event.target.value) }))
async function action(id, run, message) {
  const button = byId(id)
  button.disabled = true
  try { const result = await run(); if (message) feedback(typeof message === 'function' ? message(result) : message) }
  catch (error) { feedback(`${error.message}. Please try again.`, true) }
  finally { button.disabled = false }
}
byId('connect').onclick = () => action('connect', () => window.settings.connect(false), result => result.usageEnabled ? 'Connected. Restart open Claude Code sessions.' : 'Connected. Your existing status line was kept; the usage readout is off. Restart open Claude Code sessions.')
byId('disconnect').onclick = () => action('disconnect', () => window.settings.connect(true), 'Disconnected. Restart open Claude Code sessions before uninstalling the pet.')
byId('move').onclick = () => action('move', () => window.settings.snap(byId('corner').value), 'Pet moved.')
byId('test-sound').onclick = () => action('test-sound', () => window.settings.testSound(), 'Playing the chime at your chosen volume.')
byId('check-updates').onclick = () => action('check-updates', () => window.settings.checkUpdates())
byId('install-update').onclick = () => window.settings.installUpdate()
byId('releases').onclick = () => action('releases', () => window.settings.openReleases())
window.settings.onChange(render)
window.settings.get().then(render).catch(error => feedback(`Could not load settings: ${error.message}. Close and reopen Settings.`, true))
