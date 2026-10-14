// Small, bounded DOM layers; no render loop runs while the pet is hidden.
window.createPetEffects = ({ scene, card, character, onWake, onReady }) => {
  const motion = matchMedia('(prefers-reduced-motion: reduce)')
  const defaults = { vfx: true, vfxNight: true, vfxAtmosphere: true, vfxActivity: true, vfxCelebration: true, vfxScanlines: false, bootSequence: true, vfxIntensity: 35 }
  let prefs = { ...defaults }, state = 'idle', environment = {}, signature = '', bootTimers = [], pendingBoot = false, nativeVisible = true
  const layer = name => {
    const el = document.createElement('div')
    el.className = `fx-layer fx-${name}`
    el.setAttribute('aria-hidden', 'true')
    scene.appendChild(el)
    return el
  }
  const night = layer('night'), atmosphere = layer('atmosphere'), activity = layer('activity'), celebration = layer('celebration'), scanlines = layer('scanlines'), boot = layer('boot')
  boot.hidden = true
  const running = () => prefs.vfx && !prefs.compact && !motion.matches && !document.hidden && nativeVisible
  const count = (low, high) => Math.round(low + (high - low) * prefs.vfxIntensity / 100)
  const particle = (parent, cls, x, y, duration, delay = 0) => {
    const el = document.createElement('i')
    el.className = cls
    Object.assign(el.style, { left: `${x}px`, top: `${y}px`, animationDuration: `${duration}s`, animationDelay: `${delay}s` })
    parent.appendChild(el)
    return el
  }
  function stopBoot() {
    const playing = !boot.hidden
    bootTimers.forEach(clearTimeout)
    bootTimers = []
    boot.hidden = true
    boot.replaceChildren()
    scene.classList.remove('fx-booting')
    if (playing) onReady()
  }
  function clearCelebration() {
    celebration.replaceChildren()
    card.classList.remove('shimmer')
  }
  function syncActivity() {
    activity.replaceChildren()
    card.classList.toggle('glow', running() && prefs.vfxActivity && state === 'waiting-for-you')
    if (!running() || !prefs.vfxActivity || !['thinking', 'using-tool', 'directing-helpers', 'reading', 'writing', 'running-commands', 'searching-web', 'searching-code', 'testing', 'committing', 'compacting', 'plan-progress', 'typing'].includes(state)) return
    const center = parseFloat(character.style.left || '95') + 64
    for (let i = 0; i < count(2, 5); i++) particle(activity, 'fx-work-spark', center + (i % 2 ? 38 : -38), 48 + i * 7, 2.4 + i * 0.4, -i * 0.8)
  }
  function refresh() {
    const enabled = running()
    const clearSky = ['clear', 'partly'].includes(environment.kind)
    const isNight = environment.hour >= 20.5 || environment.hour < 5.5
    const nightOn = enabled && prefs.vfxNight && clearSky && isNight
    scene.classList.toggle('fx-night-on', nightOn)
    scene.classList.toggle('fx-clouds-on', enabled && prefs.vfxAtmosphere)
    scene.classList.toggle('fx-paused', !enabled)
    scene.style.setProperty('--fx-strength', String(0.25 + prefs.vfxIntensity * 0.0075))
    scanlines.hidden = !prefs.vfx || !prefs.vfxScanlines || prefs.compact
    const sig = JSON.stringify([enabled, prefs.vfxNight, prefs.vfxAtmosphere, prefs.vfxIntensity, environment])
    if (sig !== signature) {
      signature = sig
      night.replaceChildren()
      atmosphere.replaceChildren()
      if (nightOn) {
        for (let i = 0; i < count(4, 10); i++) particle(night, 'fx-firefly', 18 + i * 29, 76 + (i * 11) % 24, 3.2 + i % 3, -i * 0.7)
        for (let i = 0; i < count(1, 2); i++) particle(night, 'fx-shooting-star', 18 + i * 155, 12 + i * 8, 38 + i * 19, -i * 7)
      }
      if (enabled && prefs.vfxAtmosphere && clearSky) {
        for (let i = 0; i < count(3, 8); i++) particle(atmosphere, 'fx-dust', 16 + i * 41, 56 + i % 4 * 10, 8 + i, -i * 2)
        if ([8, 9, 10].includes(environment.month)) {
          for (let i = 0; i < count(2, 5); i++) particle(atmosphere, 'fx-leaf', 22 + i * 63, -8, 12 + i * 2, -i * 4)
        }
      }
    }
    if (!enabled || !prefs.bootSequence) stopBoot()
    if (!enabled || !prefs.vfxCelebration) clearCelebration()
    syncActivity()
    if (pendingBoot && !document.hidden && nativeVisible) { pendingBoot = false; startBoot() }
  }
  function startBoot() {
    stopBoot()
    if (!running() || !prefs.bootSequence || state !== 'idle') return false
    boot.hidden = false
    boot.innerHTML = '<span>Waking Claude<span class="fx-boot-dots">...</span></span><div class="fx-boot-track"><i></i></div>'
    scene.classList.add('fx-booting')
    bootTimers.push(setTimeout(() => {
      if (!running() || state !== 'idle') { stopBoot(); return }
      scene.classList.remove('fx-booting')
      boot.classList.add('fx-boot-reveal')
      onWake()
    }, 800))
    boot.classList.remove('fx-boot-reveal')
    bootTimers.push(setTimeout(stopBoot, 800 + window.PET_ANIMATIONS.states.greeting.duration * 1000))
    return true
  }
  function onState(next) {
    const changed = state !== next
    state = next
    if (next !== 'idle') stopBoot()
    syncActivity()
    if (next !== 'done') { clearCelebration(); return }
    if (!changed || !running() || !prefs.vfxCelebration) return
    clearCelebration()
    void card.offsetWidth
    card.classList.add('shimmer')
    const center = parseFloat(character.style.left || '95') + 64
    for (let i = 0; i < count(3, 6); i++) {
      const el = particle(celebration, 'sp', center - 48 + i * 19, 20 + (i % 3) * 16, 0.9, i * 0.12)
      el.addEventListener('animationend', () => { el.remove(); if (!celebration.childElementCount) card.classList.remove('shimmer') }, { once: true })
    }
  }
  motion.addEventListener('change', refresh)
  document.addEventListener('visibilitychange', refresh)
  return {
    configure(patch) { prefs = { ...prefs, ...patch }; if (patch.boot) pendingBoot = true; refresh() },
    environment(value) { environment = value; refresh() },
    setVisible(value) { nativeVisible = value; refresh() },
    onState,
    previewBoot: startBoot,
    isBooting: () => !boot.hidden,
  }
}
