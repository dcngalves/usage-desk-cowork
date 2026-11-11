import type { EngineInterface, Register, SessionUsage, ToolCallInput, ToolCallResult } from 'claude-code'

// Runs inside the Cowork task. It collects what the window shows and hands it to the program on
// the person's computer, through the app's own connection, without asking Claude.
const OPEN_TOOL = 'open_usage_desk'
const REPORT_TOOL = 'report_usage'
const FIVE_H = 5 * 3600_000
const WEEK = 7 * 24 * 3600_000
const FIVE_M = 5 * 60_000
const ONE_H = 3600_000
const SEND_GAP_MS = 1500
const IDLE_ASK_MS = 5000
// With no panel open it still asks now and then, so a panel opened later is noticed.
const IDLE_CHECK_MS = 20000
// A send that Cowork neither allows nor refuses must not block the ones after it.
const SEND_WAIT_MS = 8000
const EXACT_EVERY = 2 * 60_000

// Keep warm: one small ping shortly before the cache goes cold. It uses a little of the limit,
// so it has a hard stop and ends the moment the person sends a message.
const WARM_LEAD = 45_000
const WARM_MAX_PINGS = 12
const WARM_MAX_MS = 2 * ONE_H
const WARM_PROMPT = 'Reply with the single word: ok'
const HANDOFF_PROMPT = 'Write a short handoff for a fresh task: the goal, what is done, what is left, and the files that matter. Keep it under 200 words.'
const BACKGROUND = new Set(['task-notification', 'scheduled-trigger', 'peer', 'peer-send-message', 'projects-relay', 'channel', 'coordinator'])

type Limit = { percent: number; resetsAt: string; isLive: boolean; readAt: number }
type Activity = { id: string; tool: string; label: string; agent: string; isDone: boolean; isFailed: boolean; at: number }
type AgentRun = { id: string; agentId: string; type: string; description: string; model: string; status: 'running' | 'done' | 'failed'; startedAt: number; endedAt: number; contextTokens: number; tokens: number; input: number; output: number; cacheWrite: number; cacheRead: number; steps: number; current: string }

// Module variables start over on a reload, and the next report refills the window.
const snapshot: { chatTokens: number; chatWindow: number; chatPercent: number; five: Limit | null; week: Limit | null; model: string; cost: number; startedAt: number } = { chatTokens: 0, chatWindow: 0, chatPercent: 0, five: null, week: null, model: '', cost: 0, startedAt: 0 }
let breakdown: unknown = null
let scan: { chat?: { ttl?: string } } | null = null
let isDeepDirty = false
const live = { isWorking: false, recent: [] as Activity[], counts: {} as Record<string, number>, files: [] as string[], skills: [] as string[], connectors: {} as Record<string, number> }
let agents: AgentRun[] = []
const cache = { lastEnd: 0, ttlMs: FIVE_M, isKnown: false, tokens: 0 }
const warm = { isOn: false, startedAt: 0, pings: 0, isSending: false, failures: 0, note: '' }
let notice = { text: '', at: 0 }
// What each request to Claude really used. Cowork's log leaves most of them at zero.
const steps: Record<string, { input: number; output: number; cacheWrite: number; cacheRead: number; requests: number }> = {}
const link = { isOpen: false, quickRuns: 0, opened: '' }

// Where the program's tools are: its own server, or the app's device bridge, which puts the
// extension's name in front of each tool (mcp__remote-devices__Usage_Desk__report_usage).
let server: { name: string; prefix: string } | undefined
let sid = ''
let cwd = ''
let isSending = false
let isScanning = false
let isPinging = false
let lastSent = 0
let lastExactAt = 0
let isViewing = true

const quiet = (work: Promise<unknown>) => work.catch(() => undefined)

// Plugins uploaded in Cowork also reach Code tab chats, where this should stay out of the way.
let isCowork = false
let isStarted = false
async function inCowork($: EngineInterface) {
  if (!isCowork) {
    // A task that has not used its sandbox yet has another HOME, so the link to the person's
    // computer, which only Cowork tasks have, is checked too.
    isCowork = (await $.env.get('HOME')) === '/root' || (await $.tool.list()).some(t => t.name.startsWith('mcp__remote-devices__'))
  }
  if (isCowork && !isStarted) {
    isStarted = true
    await start($)
  }
  return isCowork
}

async function note($: EngineInterface, section: string, value: unknown) {
  await quiet($.process.run(['python3', '-I', `${$.plugin.root}/hooks/note.py`, cwd, section, JSON.stringify(value)]))
}

async function findServer($: EngineInterface) {
  if (server) return server
  const names = (await $.tool.list()).map(t => t.name)
  const hit = names.find(n => n.startsWith('mcp__') && n.endsWith(`__${OPEN_TOOL}`))
  if (!hit) {
    // A new task may not list the computer's tools until Claude loads them. Try the usual address anyway.
    await note($, 'tools', { guessed: true, total: names.length, near: names.filter(n => /usage|remote-devices/i.test(n)).slice(0, 40) })
    return { name: 'remote-devices', prefix: 'Usage_Desk__' }
  }
  const rest = hit.slice('mcp__'.length)
  const cut = rest.indexOf('__')
  server = { name: rest.slice(0, cut), prefix: rest.slice(cut + 2, -OPEN_TOOL.length) }
  await note($, 'tools', { found: hit })
  return server
}

const baseName = (path: string) => path.split(/[\\/]/).filter(Boolean).pop() ?? path
const shortLabel = (label: string) => (/^[/~]/.test(label) ? baseName(label) : label).slice(0, 60)
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

// The app's own housekeeping and tool lookups are not jobs anyone asked for.
const isHousekeeping = (tool: string): boolean => /usage[-_]desk|Claude_Browser__(preview_start|request_access)|^mcp__(ccd_|plugin-authoring|terminal__read)/i.test(tool) || /^(ToolSearch|TodoWrite|TaskCreate|TaskUpdate|TaskList|TaskGet|Monitor|ListAgents)$/.test(tool)
const friendlyTool = (tool: string): string => {
  if (!tool.startsWith('mcp__')) return tool
  const [, name = '', action = ''] = tool.split('__')
  return `${name.replace(/^plugin_[^_]*_/, '')}: ${action.replace(/_/g, ' ')}`
}
const connectorOf = (tool: string): string => (tool.startsWith('mcp__') ? (tool.split('__')[1] ?? '') : '')

// The label a tool call gets in the live list. Paths and searches, never file contents.
const labelOf = (e: Record<string, unknown>): string => {
  for (const key of ['file_path', 'path', 'notebook_path', 'url', 'query', 'pattern', 'description', 'skill', 'command']) {
    const v = e[key]
    if (typeof v === 'string' && v) return shortLabel(v.split('\n')[0] ?? '')
  }
  return ''
}

const limitOf = (usage: SessionUsage, kind: string, at: number): Limit | null => {
  const r = usage.rateLimits.find(x => x.kind === kind)
  if (!r) return null
  const resetAt = r.resetsAt ? Date.parse(r.resetsAt) : NaN
  // The figure is from the last reply. Once its window has reset, it no longer holds.
  if (Number.isFinite(resetAt) && resetAt <= at) return { percent: 0, resetsAt: '', isLive: true, readAt: 0 }
  return { percent: r.percentUsed, resetsAt: r.resetsAt ?? '', isLive: true, readAt: 0 }
}

const toBreakdown = (usage: SessionUsage) => {
  const b = usage.context.breakdown
  if (!b) return null
  return {
    categories: b.categories.filter(c => c.kind !== 'deferred').map(c => ({ name: c.name, tokens: c.tokens, color: c.color, kind: c.kind })),
    grid: b.gridRows.map(row => row.map(s => ({ name: s.categoryName, isFilled: s.isFilled, fullness: s.squareFullness }))),
    memory: b.memoryFiles.map(f => ({ name: baseName(f.path), tokens: f.tokens, detail: f.type })),
    mcp: Object.values(
      b.mcpTools.filter(t => t.isLoaded).reduce<Record<string, { name: string; tokens: number; detail: string; n: number }>>((all, t) => {
        const row = all[t.serverName] ?? { name: t.serverName, tokens: 0, detail: '', n: 0 }
        row.tokens += t.tokens
        row.n += 1
        row.detail = plural(row.n, 'tool')
        all[t.serverName] = row
        return all
      }, {}),
    ).map(({ name, tokens, detail }) => ({ name, tokens, detail })),
    skills: (b.skills?.skillFrontmatter ?? []).map(s => ({ name: s.name, tokens: s.tokens })),
    agents: b.agents.map(a => ({ name: a.agentType, tokens: a.tokens })),
    model: b.model,
  }
}

const windowStart = (limit: Limit | null, length: number, at: number): number => {
  const t = limit?.resetsAt ? Date.parse(limit.resetsAt) : NaN
  return Number.isFinite(t) && t > at ? t - length : at - length
}

async function runScan($: EngineInterface, at: number) {
  if (isScanning) return
  isScanning = true
  try {
    const five = windowStart(snapshot.five, FIVE_H, at)
    const week = windowStart(snapshot.week, WEEK, at)
    const out = await $.process.run(['python3', '-I', `${$.plugin.root}/hooks/scan.py`, sid, String(Math.floor(five)), String(Math.floor(week))])
    scan = JSON.parse(String(out.stdout))
    isDeepDirty = true
  } catch (error) {
    await note($, 'scan', String(error).slice(0, 300))
  } finally {
    isScanning = false
  }
}

async function refresh($: EngineInterface, deep: boolean, exact = false) {
  const at = await $.clock.now()
  const isExact = exact && at - lastExactAt >= 10_000
  if (isExact) lastExactAt = at
  const usage = await $.session.usage(deep ? { breakdown: isExact || at - lastExactAt >= EXACT_EVERY ? 'full' : 'summary' } : undefined)
  snapshot.chatTokens = usage.context.tokens ?? snapshot.chatTokens
  snapshot.chatWindow = usage.context.window || snapshot.chatWindow
  snapshot.chatPercent = usage.context.percent ?? snapshot.chatPercent
  snapshot.five = limitOf(usage, 'five_hour', at) ?? snapshot.five
  snapshot.week = limitOf(usage, 'seven_day', at) ?? snapshot.week
  snapshot.cost = usage.cost?.usd ?? snapshot.cost
  snapshot.startedAt = usage.startedAt || snapshot.startedAt
  snapshot.model = usage.context.breakdown?.model || snapshot.model
  if (deep) {
    const fresh = toBreakdown(usage)
    if (fresh) {
      breakdown = fresh
      isDeepDirty = true
    }
    await runScan($, at)
  }
}

// Claude's one call from the /cowork-usage skill. The task's id is added here, so Claude need not
// look it up. Claude opens the panel itself: an open asked for from here reports success but shows nothing.
async function greet($: EngineInterface, e: ToolCallInput, next: (e: ToolCallInput) => Promise<ToolCallResult>) {
  if (!sid) sid = await $.session.id()
  const given = (e as unknown as { session?: unknown }).session
  const result = await next({ ...e, session: typeof given === 'string' && given ? given : sid, viaPlugin: true } as ToolCallInput)
  return result
}

// Sends the latest figures. Only one send runs at a time, so a pending permission card can't pile up.
async function send($: EngineInterface, isCheck = false) {
  if (isSending) return
  isSending = true
  lastSent = Date.now()
  try {
    const name = await findServer($)
    if (!name) throw new Error('the program on the computer is not connected')
    const state: Record<string, unknown> = { snapshot, live, agents, cache, warm, notice, steps, link }
    if (isDeepDirty && !isCheck) {
      state.breakdown = breakdown
      state.scan = scan
      isDeepDirty = false
    }
    const began = Date.now()
    // A check carries no figures: it only asks whether a panel is open and what its buttons asked for.
    if (!sid) sid = await $.session.id()
    const call = $.mcp.call(name.name, name.prefix + REPORT_TOOL, isCheck ? { session: sid, state: {}, isCheck: true } : { session: sid, state, sentAt: began })
    const result = await Promise.race([call, $.clock.sleep(SEND_WAIT_MS).then(() => undefined)])
    if (!result) throw new Error('the program on the computer did not answer in time')
    if (result.isError) throw new Error(`the program refused the figures: ${JSON.stringify(result.content).slice(0, 220)}`)
    // A send from here can never raise a permission card: it is refused until the person has
    // chosen Always allow. So one that got through means the plugin may keep sending.
    link.quickRuns += 1
    link.isOpen = true
    await note($, 'send', { ok: true, ms: Date.now() - began })
    const text = result.content.map(c => ('text' in c ? String(c.text) : '')).join('')
    const answer = JSON.parse(text) as { viewing?: boolean; actions?: string[] }
    isViewing = answer.viewing === true
    for (const action of answer.actions ?? []) await act($, action)
  } catch (error) {
    // Declined or failed: wait for the next reply, and never ask again before then.
    link.quickRuns = 0
    link.isOpen = false
    await note($, 'send', String(error).slice(0, 300))
  } finally {
    isSending = false
  }
}

const say = (text: string) => { notice = { text, at: Date.now() } }

async function fillPrompt($: EngineInterface, text: string): Promise<boolean> {
  try {
    return (await $.prompt.fill({ text })).isFilled
  } catch {
    return false
  }
}

// What the window's buttons ask for.
async function act($: EngineInterface, action: string) {
  if (action === 'exact') {
    await refresh($, true, true)
  } else if (action === 'warm') {
    if (warm.isOn) {
      warm.isOn = false
      warm.note = 'Keep warm is off.'
    } else if (!cache.lastEnd) {
      warm.note = 'Nothing to keep warm until Claude has replied.'
    } else {
      Object.assign(warm, { isOn: true, startedAt: await $.clock.now(), pings: 0, isSending: false, failures: 0, note: '' })
    }
  } else if (action === 'compact') {
    try {
      await $.command.run({ command: 'compact' })
      say('Compact ran. The task shows the result.')
      await refresh($, true)
    } catch {
      say((await fillPrompt($, '/compact')) ? '/compact is in your prompt box. Press Return to run it. This uses some tokens once.' : 'Usage Desk could not reach the prompt box. Type /compact in the task to compact it.')
    }
  } else if (action === 'handoff') {
    say((await fillPrompt($, HANDOFF_PROMPT)) ? 'A handoff request is in your prompt box. Nothing has been sent.' : 'Usage Desk could not reach the prompt box, so nothing was added.')
  }
  if (link.isOpen) void quiet(send($))
}

function stopWarm(text: string) {
  if (warm.isOn) Object.assign(warm, { isOn: false, isSending: false, note: text })
}

async function warmTick($: EngineInterface, at: number) {
  if (!warm.isOn || isPinging || live.isWorking) return
  if (at - warm.startedAt >= WARM_MAX_MS) return stopWarm('Keep warm stopped after 2 hours.')
  if (warm.pings >= WARM_MAX_PINGS) return stopWarm(`Keep warm stopped after ${WARM_MAX_PINGS} pings.`)
  if (at < cache.lastEnd + cache.ttlMs - WARM_LEAD) return
  isPinging = true
  warm.isSending = true
  try {
    const r = await $.model.fork({ prompt: WARM_PROMPT })
    warm.isSending = false
    if (r.isAnswered || r.reason === 'empty-reply') {
      cache.lastEnd = await $.clock.now()
      warm.pings += 1
      warm.failures = 0
    } else {
      warm.failures += 1
      if (warm.failures >= 3) stopWarm('Keep warm stopped: three pings in a row failed.')
    }
  } catch {
    stopWarm('Keep warm stopped: a ping failed.')
  } finally {
    isPinging = false
  }
}

// Runs once per task, from whichever hook first finds itself in Cowork.
async function start($: EngineInterface) {
  sid = await $.session.id()
  void note($, 'start', { at: Date.now(), task: sid })
  void quiet(refresh($, true))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    cwd = e.cwd
    await quiet(inCowork($))

    let ticks = 0
    $.clock.every(1000, () => {
      ticks += 1
      void (async () => {
        // Until the task is known to be a Cowork one, it only looks again now and then.
        if (!isCowork && (ticks % (ticks < 60 ? 5 : 60) !== 0 || !(await inCowork($)))) return
        const at = await $.clock.now()
        await warmTick($, at)
        if (live.isWorking && ticks % 5 === 0) await refresh($, false)
        if (live.isWorking && ticks % 15 === 0) await runScan($, at)
        if (ticks % 60 === 0) await refresh($, !live.isWorking)
        const gap = Date.now() - lastSent
        // Between replies it only sends once Cowork has stopped asking about each send.
        // While the window is open, an idle check also collects what its buttons asked for.
        if (link.isOpen && ((live.isWorking && gap >= SEND_GAP_MS) || (isViewing && gap >= IDLE_ASK_MS))) await send($)
        else if (link.isOpen && gap >= IDLE_CHECK_MS) await send($, true)
      })().catch(() => undefined)
    })
    return started
  })

  on('prompt.submit', async ($, e, next) => {
    if (!(await inCowork($))) return next(e)
    if (e.text !== WARM_PROMPT && !isPinging) {
      live.isWorking = true
      if (!BACKGROUND.has(e.origin?.kind ?? '')) stopWarm('Keep warm stopped: you sent a message.')
      // Tells the panel right away that Claude has started, so the owl gets to work. Only once a
      // send has got through in this task: before that, Cowork may hold the call without answering.
      if (link.isOpen) void send($)
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  // What the agent touches, as it happens.
  on('tool.call', async ($, e, next) => {
    let tool: string = e.tool
    if (/__report_usage$/.test(tool) && !('state' in e) && (await inCowork($))) return greet($, e, next)
    if (isHousekeeping(tool) || !(await inCowork($))) return next(e)
    const fields = e as unknown as Record<string, unknown>
    // A command is shown by Claude's own description of it, never as raw shell text.
    const label = tool === 'Bash' ? (typeof fields.description === 'string' ? fields.description : '') : labelOf(fields)
    // Opening a page that already exists is not making one.
    const isOpening = tool === 'Artifact' && fields.action === 'open'
    if (isOpening) tool = 'ArtifactOpen'
    const row: Activity = { id: e.tool_use_id, tool, label: isOpening ? '' : label, agent: e.agentId ?? '', isDone: false, isFailed: false, at: Date.now() }
    live.isWorking = true
    live.recent = [...live.recent, row].slice(-30)
    live.counts[tool] = (live.counts[tool] ?? 0) + 1
    if ((tool === 'Read' || tool === 'Edit' || tool === 'Write') && label && !live.files.includes(label)) live.files = [...live.files, label].slice(-50)
    if (tool === 'Skill' && label && !live.skills.includes(label)) live.skills = [...live.skills, label]
    const connector = connectorOf(tool)
    if (connector) live.connectors[connector] = (live.connectors[connector] ?? 0) + 1
    if (e.agentId) agents = agents.map(a => (a.agentId === e.agentId ? { ...a, current: `${friendlyTool(tool)}${label ? ` · ${label}` : ''}` } : a))
    let failed = true
    try {
      const out = await next(e)
      failed = false
      return out
    } finally {
      row.isDone = true
      row.isFailed = failed
    }
  }).catch(($, e, next) => next(e))

  on('agent.spawn', async ($, e, next) => {
    const started = await next(e)
    if (started.deny !== undefined) return started
    const run: AgentRun = { id: started.agentId ?? e.tool_use_id, agentId: started.agentId ?? '', type: e.subagentType, description: e.description, model: started.model ?? '', status: 'running', startedAt: Date.now(), endedAt: 0, contextTokens: 0, tokens: 0, input: 0, output: 0, cacheWrite: 0, cacheRead: 0, steps: 0, current: '' }
    agents = [...agents.filter(a => a.id !== run.id), run].slice(-40)
    return started
  }).catch(($, e, next) => next(e))

  on('turn.step', async function* ($, e, next) {
    const result = yield* next(e)
    const usage = result.usage
    const agentId = e.agentId
    if (!agentId && usage && (await inCowork($))) {
      const row = (steps[usage.model || snapshot.model || 'unknown'] ??= { input: 0, output: 0, cacheWrite: 0, cacheRead: 0, requests: 0 })
      row.input += usage.input_tokens || 0
      row.output += usage.output_tokens || 0
      row.cacheWrite += usage.cache_creation_input_tokens || 0
      row.cacheRead += usage.cache_read_input_tokens || 0
      row.requests += 1
    }
    if (agentId && usage) {
      const i = usage.input_tokens || 0
      const o = usage.output_tokens || 0
      const w = usage.cache_creation_input_tokens || 0
      const r = usage.cache_read_input_tokens || 0
      agents = agents.map(a => (a.agentId !== agentId ? a : { ...a, model: usage.model || a.model, status: 'running', contextTokens: i + o + w + r, tokens: a.tokens + i + o + w + r, input: a.input + i, output: a.output + o, cacheWrite: a.cacheWrite + w, cacheRead: a.cacheRead + r, steps: a.steps + 1 }))
    }
    return result
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (!(await inCowork($))) return result
    const at = await $.clock.now()
    if (e.agentId) {
      agents = agents.map(a => (a.agentId === e.agentId ? { ...a, status: e.reason === 'answer' ? 'done' : 'failed', endedAt: at, current: '' } : a))
      return result
    }
    live.isWorking = false
    void (async () => {
      // The quick figures go first, so the panel never waits on the slower breakdown.
      cache.lastEnd = at
      await quiet(refresh($, false))
      cache.tokens = snapshot.chatTokens
      await send($)
      await refresh($, true)
      const ttl = scan?.chat?.ttl
      Object.assign(cache, { ttlMs: ttl === '1h' ? ONE_H : ttl === '5m' ? FIVE_M : cache.ttlMs, isKnown: ttl === '1h' || ttl === '5m', tokens: snapshot.chatTokens })
      await send($)
    })().catch(() => undefined)
    return result
  })
}
