const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createIdleAnimations } = require('../idle-animations')
const animations = { idle: { duration: 6 }, look: { duration: 7 }, breathe: { duration: 8 } }
const variants = Object.keys(animations)

test('quiet idles have higher selection weight while the previous animation stays excluded', () => {
  let random = 0
  const cycle = createIdleAnimations({ variants, animations, weights: { idle: 2, look: 3, breathe: 3 }, random: () => random, onChange: () => {} })
  cycle.setPaused(true)
  for (const [value, expected] of [[0, 'idle'], [.249, 'idle'], [.25, 'look'], [.624, 'look'], [.625, 'breathe'], [.999, 'breathe']]) {
    random = value
    assert.equal(cycle.resolve('idle'), expected)
  }
  cycle.show('look')
  random = .399
  assert.equal(cycle.resolve('idle'), 'idle')
  random = .4
  assert.equal(cycle.resolve('idle'), 'breathe')
  cycle.dispose()
})

test('idle changes finish whole loops and choose either alternative without repeating', t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 })
  const shown = []
  let random = 0
  const cycle = createIdleAnimations({ variants, animations, random: () => random, onChange: name => { shown.push(name); cycle.show(name) } })
  cycle.show('idle')
  t.mock.timers.tick(5999)
  assert.deepEqual(shown, [])
  t.mock.timers.tick(1)
  assert.deepEqual(shown, ['look'])
  random = .99
  t.mock.timers.tick(7000)
  assert.deepEqual(shown, ['look', 'breathe'])
  t.mock.timers.tick(15999)
  assert.equal(shown.length, 2, 'long holds finish two full cycles')
  t.mock.timers.tick(1)
  assert.equal(shown[2], 'look')
  cycle.dispose()
})

test('walking, gags, greetings and work cancel idle switching immediately', t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 })
  const shown = []
  const cycle = createIdleAnimations({ variants, animations, random: () => 0, onChange: name => shown.push(name) })
  for (const active of ['walking', 'gag-coffee', 'greeting', 'thinking']) {
    cycle.show('idle')
    t.mock.timers.tick(1000)
    cycle.show(active)
    t.mock.timers.tick(60000)
    assert.deepEqual(shown, [])
  }
  cycle.show('idle')
  t.mock.timers.tick(6000)
  assert.deepEqual(shown, ['look'], 'rotation resumes when idle returns')
  cycle.dispose()
})

test('hidden and reduced-motion pauses stop changes and resume at a loop boundary', t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 })
  const shown = []
  const cycle = createIdleAnimations({ variants, animations, random: () => 0, onChange: name => shown.push(name) })
  cycle.show('idle')
  t.mock.timers.tick(1000)
  cycle.setPaused(true)
  t.mock.timers.tick(20000)
  assert.deepEqual(shown, [])
  cycle.setPaused(false)
  t.mock.timers.tick(2999)
  assert.deepEqual(shown, [])
  t.mock.timers.tick(1)
  assert.deepEqual(shown, ['look'])
  cycle.dispose()
})

test('returning from a walk chooses a different idle pose and active names are unchanged', () => {
  const cycle = createIdleAnimations({ variants, animations, random: () => 0, onChange: () => {} })
  cycle.setPaused(true)
  cycle.show('idle')
  cycle.show('walking')
  assert.equal(cycle.resolve('idle'), 'look')
  assert.equal(cycle.resolve('thinking'), 'thinking')
  cycle.dispose()
})
