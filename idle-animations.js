;(function () {
  function createIdleAnimations({ variants, animations, onChange, weights = {}, random = () => Math.random() }) {
    let current = null, lastIdle = null, timer = null, started = 0, paused = false
    const clear = () => { clearTimeout(timer); timer = null }
    const choose = () => {
      const choices = variants.filter(name => name !== lastIdle)
      let pick = random() * choices.reduce((total, name) => total + (weights[name] ?? 1), 0)
      for (const name of choices) {
        const weight = weights[name] ?? 1
        if (pick < weight) return name
        pick -= weight
      }
      return choices[choices.length - 1]
    }
    const schedule = () => {
      if (paused || !variants.includes(current)) return
      const cycle = animations[current].duration * 1000
      // Change at a complete loop boundary, including after a visibility pause.
      const elapsed = Date.now() - started
      const nextLoop = Math.floor(elapsed / cycle) + 1 + Math.floor(random() * 2)
      timer = setTimeout(() => { timer = null; onChange(choose()) }, Math.round(nextLoop * cycle - elapsed))
    }
    return {
      resolve: name => name === 'idle' ? choose() : name,
      show(name) {
        clear(); current = name; started = Date.now()
        if (variants.includes(name)) lastIdle = name
        schedule()
      },
      setPaused(value) {
        if (paused === value) return
        paused = value; clear()
        if (!paused) schedule()
      },
      dispose: clear,
    }
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { createIdleAnimations }
  else window.createIdleAnimations = createIdleAnimations
})()
