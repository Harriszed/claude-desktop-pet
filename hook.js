// Claude Code hook / status line: forwards events to the desktop pet. Silent, fast, and never blocks Claude.
const http = require('http')
const path = require('path')
let raw = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', c => { raw += c })

const post = (url, body) => {
  const data = JSON.stringify(body)
  const req = http.request({ host: '127.0.0.1', port: 47821, path: url, method: 'POST', timeout: 700, headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } }, res => { res.resume(); res.on('end', () => process.exit(0)) })
  req.on('error', () => process.exit(0))
  req.on('timeout', () => { req.destroy(); process.exit(0) })
  req.end(data)
}

const short = (t, n) => (typeof t === 'string' ? t.replace(/\s+/g, ' ').trim().slice(0, n) : '')
const detailOf = i => {
  if (!i || typeof i !== 'object') return ''
  const file = i.file_path || i.notebook_path || i.path
  if (file) return path.basename(String(file))
  if (i.pattern) return short(i.pattern, 60)
  if (i.query) return short(i.query, 60)
  if (i.url) { try { return new URL(i.url).hostname } catch { return short(i.url, 60) } }
  if (i.command) return short(i.command, 80)
  if (i.description) return short(i.description, 60)
  return ''
}

const send = () => {
  let e = {}
  try { e = JSON.parse(raw || '{}') } catch { e = {} }
  if (process.argv[2] === '--statusline') {
    try { require('fs').writeFileSync(require('path').join(require('os').tmpdir(), 'claude-pet-statusline.json'), raw) } catch { void 0 }
    const r = e.rate_limits || {}
    const c = e.context_window || {}
    post('/usage', { five: r.five_hour || null, seven: r.seven_day || null, session: e.session_id || '', ctx: typeof c.used_percentage === 'number' ? c.used_percentage : null })
    return
  }
  const i = e.tool_input
  const body = {
    event: e.hook_event_name || process.argv[2] || '',
    session: e.session_id || 'default',
    tool: e.tool_name || '',
    command: i && typeof i.command === 'string' ? i.command.slice(0, 300) : '',
    detail: detailOf(i),
    cwd: e.cwd || '',
    source: e.source || '',
    agent: e.agent_id || '',
    transcript: e.transcript_path || '',
    ppid: process.ppid,
  }
  if (i && Array.isArray(i.todos)) body.todos = i.todos.slice(0, 40).map(t => ({ s: t.status, c: short(t.content || t.subject, 60) }))
  if (i && (e.tool_name === 'TaskCreate' || e.tool_name === 'TaskUpdate')) body.task = { id: String(i.taskId || ''), status: i.status || '', subject: short(i.subject, 60) }
  post('/event', body)
}
process.stdin.on('end', send)
setTimeout(send, 1500).unref()
