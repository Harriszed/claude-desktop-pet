const { test } = require('node:test')
const assert = require('node:assert/strict')
const { usageRefreshMinutes, createUsageRefresh } = require('../usage-refresh')

test('all four refresh intervals poll at the chosen cadence', t => {
  t.mock.timers.enable({ apis: ['setInterval'] })
  for (const minutes of [1, 5, 15, 60]) {
    let calls = 0
    const refresh = createUsageRefresh(() => calls++)
    refresh.set(minutes)
    t.mock.timers.tick(minutes * 60000 - 1)
    assert.equal(calls, 0)
    t.mock.timers.tick(1)
    assert.equal(calls, 1)
    t.mock.timers.tick(minutes * 60000)
    assert.equal(calls, 2)
    refresh.dispose()
  }
})

test('changing the interval cancels the old timer, and saving the same value keeps its schedule', t => {
  t.mock.timers.enable({ apis: ['setInterval'] })
  let calls = 0
  const refresh = createUsageRefresh(() => calls++)
  refresh.set(1)
  t.mock.timers.tick(30000)
  refresh.set(1)
  t.mock.timers.tick(30000)
  assert.equal(calls, 1)
  refresh.set(60)
  t.mock.timers.tick(59 * 60000)
  assert.equal(calls, 1, 'the old one-minute timer was cancelled')
  t.mock.timers.tick(60000)
  assert.equal(calls, 2)
  refresh.dispose()
  t.mock.timers.tick(60 * 60000)
  assert.equal(calls, 2, 'quitting stops polling')
})

test('missing or invalid saved preferences fall back to five minutes', () => {
  for (const value of [undefined, null, 0, -1, 2, '15', Infinity, NaN]) assert.equal(usageRefreshMinutes(value), 5)
})
