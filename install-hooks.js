// CLI setup for source installs. Packaged apps connect from Settings instead.
const path = require('path')
const { configureHooks, hookCommand } = require('./hook-settings')
const hook = path.join(__dirname, 'hook.js')
try {
  const remove = process.argv.includes('--remove')
  const options = { executable: process.execPath, hook }
  const result = configureHooks({ command: hookCommand(options), statusCommand: hookCommand({ ...options, statusline: true }), remove, legacyPaths: [hook] })
  console.log(remove ? 'Hooks removed.' : 'Hooks connected. Restart open Claude Code sessions.')
  if (!remove && !result.usageEnabled) console.log('Your existing status line was preserved; the pet usage readout is off.')
} catch (error) {
  console.error(`Could not update Claude settings: ${error.message}`)
  process.exitCode = 1
}
