const { spawn } = require('child_process')
const { randomUUID } = require('crypto')
const fs = require('fs')

// Recognise only our generated command shape. Never execute settings as a shell script.
function parsePetCommand(command) {
  const ps = /^powershell\.exe -NoProfile -NonInteractive -EncodedCommand (\S+)$/.exec(command)
  if (ps) {
    const script = Buffer.from(ps[1], 'base64').toString('utf16le')
    const match = /^(\$env:ELECTRON_RUN_AS_NODE='1'; )?& '((?:[^']|'')*)' '((?:[^']|'')*)' '--claude-desktop-pet'$/.exec(script)
    if (!match) throw new Error('Choose Repair connection, then test again.')
    return { executable: match[2].replace(/''/g, "'"), hook: match[3].replace(/''/g, "'"), packaged: !!match[1] }
  }
  const word = "('(?:[^']*)'(?:\"'\"'[^']*')*)"
  const match = new RegExp(`^(ELECTRON_RUN_AS_NODE=1 )?${word} ${word} --claude-desktop-pet$`).exec(command)
  if (!match) throw new Error('Choose Repair connection, then test again.')
  const unquote = value => value.slice(1, -1).replace(/'"'"'/g, "'")
  return { executable: unquote(match[2]), hook: unquote(match[3]), packaged: !!match[1] }
}

function createConnectionTest({ getCommand, onChange = () => {}, timeoutMs = 8000, spawnHook = spawn, env = process.env }) {
  let state = { phase: 'idle', message: '' }, pending
  const emit = value => { state = value; onChange(state) }
  const receive = value => {
    if (!pending || value?.nonce !== pending.nonce) return false
    pending.finish({ phase: 'passed', message: 'Test passed. The configured pet hook reached this app. Restart open Claude Code sessions after connecting or repairing, then send a message there to check live activity.' })
    return true
  }
  const test = () => {
    if (pending) return pending.promise
    emit({ phase: 'testing', message: 'Testing the configured pet hook…' })
    let launch
    try {
      launch = parsePetCommand(getCommand())
      if (!fs.readFileSync(launch.hook, 'utf8').includes('--connection-test')) throw new Error('The connected hook needs updating. Choose Repair connection, then test again.')
    } catch (error) {
      emit({ phase: 'failed', message: error.message })
      return Promise.resolve(state)
    }
    let resolve, timer, child
    const promise = new Promise(done => { resolve = done })
    const finish = result => {
      if (!pending) return
      clearTimeout(timer)
      pending = null
      if (child && child.exitCode === null) child.kill()
      emit(result)
      resolve(result)
    }
    pending = { nonce: randomUUID(), promise, finish }
    timer = setTimeout(() => finish({ phase: 'failed', message: 'No test message arrived. Choose Repair connection and try again. Check that only one pet copy is running.' }), timeoutMs)
    const hookEnv = { ...env }
    if (launch.packaged) hookEnv.ELECTRON_RUN_AS_NODE = '1'
    else delete hookEnv.ELECTRON_RUN_AS_NODE
    try {
      child = spawnHook(launch.executable, [launch.hook, '--claude-desktop-pet', '--connection-test', pending.nonce], { env: hookEnv, windowsHide: true, stdio: 'ignore' })
      child.once('error', () => finish({ phase: 'failed', message: 'Could not start the connected hook. Choose Repair connection and try again.' }))
      child.once('exit', code => { if (code && pending) finish({ phase: 'failed', message: 'The connected hook could not run. Choose Repair connection and try again.' }) })
    } catch {
      finish({ phase: 'failed', message: 'Could not start the connected hook. Choose Repair connection and try again.' })
    }
    return promise
  }
  return { test, receive, status: () => state, reset: () => { if (!pending) emit({ phase: 'idle', message: '' }) }, dispose: () => pending?.finish({ phase: 'failed', message: 'Test cancelled because the pet closed.' }) }
}

module.exports = { createConnectionTest, parsePetCommand }
