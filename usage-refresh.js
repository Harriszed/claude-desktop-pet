const USAGE_REFRESH_MINUTES = [1, 5, 15, 60]
const usageRefreshMinutes = value => USAGE_REFRESH_MINUTES.includes(value) ? value : 5

function createUsageRefresh(poll) {
  let timer = null, current = null
  return {
    set(value) {
      const minutes = usageRefreshMinutes(value)
      if (timer !== null && current === minutes) return
      clearInterval(timer)
      current = minutes
      timer = setInterval(poll, minutes * 60 * 1000)
    },
    dispose() { clearInterval(timer); timer = null },
  }
}

module.exports = { USAGE_REFRESH_MINUTES, usageRefreshMinutes, createUsageRefresh }
