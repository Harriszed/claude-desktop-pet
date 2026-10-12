// A short, quiet two-note chime, generated locally with no downloaded audio.
let audioContext
window.pet.onSound(async ({ volume }) => {
  const level = Math.min(100, Math.max(0, Number(volume) || 0)) / 100
  if (!level) return
  try {
    audioContext ||= new AudioContext()
    await audioContext.resume()
    const start = audioContext.currentTime
    for (const [offset, frequency] of [[0, 659.25], [0.12, 880]]) {
      const oscillator = audioContext.createOscillator()
      const gain = audioContext.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.value = frequency
      const at = start + offset
      gain.gain.setValueAtTime(0, at)
      gain.gain.linearRampToValueAtTime(level * 0.14, at + 0.012)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.3)
      oscillator.connect(gain)
      gain.connect(audioContext.destination)
      oscillator.start(at)
      oscillator.stop(at + 0.31)
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect() }
    }
  } catch { /* Audio device changes must never interrupt the pet. */ }
})
