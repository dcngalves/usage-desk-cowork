// Generated from the Usage Desk mod's code. The owl is original art for this project; its outfit motions follow savvy-progress in johnnyvizz/claude-kit (MIT, see LICENSE-claude-kit).
const FONT = "ui-sans-serif,-apple-system,'Segoe UI',sans-serif"
const FIVE_H = 5 * 3600_000, WEEK = 7 * 24 * 3600_000, FIVE_M = 5 * 60_000, ONE_H = 3600_000
const DEFAULT_NAME = 'Main agent', FIVE_COLOR = '#378ADD', WEEK_COLOR = '#7F77DD', BAD = '#D0453F', GOOD = '#3B9C5F'
const COSTUMES = [
  { value: 'other', label: 'Classic owl' },
  { value: 'fable', label: 'Astronaut' },
  { value: 'heavy', label: 'Detective' },
  { value: 'careful', label: 'Engineer' },
  { value: 'medium', label: 'Chef' },
  { value: 'light', label: 'Racer' },
  { value: 'explore', label: 'Pirate' },
  { value: 'science', label: 'Scientist' },
]


// Usage Desk's own mascot: a pixel owl with one outfit per kind of work.
// Original art for this project. The outfit's accent follows the tier colours.
const TIER_COLOR                         = {
  fable: '#7F77DD',
  heavy: '#D85A30',
  careful: '#BA7517',
  medium: '#378ADD',
  light: '#1D9E75',
  explore: '#1D9E75',
  science: '#7BC043',
  other: '#888780',
}
const colorOf = (tier        )         => TIER_COLOR[tier] ?? '#888780'

// The owl sits on a 30×28 grid: a 16×13 body, wings either side, two stepping feet.
const PLUME = '#5B6B8C'
const BELLY = '#E9DFC7'
const SPOT = '#B9AC8E'
const BEAK = '#E0A63A'
const WHITE = '#FBFAF6'
const INK = '#1F1E1D'

// `cls` puts a pixel in a named group: `bd` (the default) is the body and its
// outfit, `la`/`lb` the two feet, anything else a prop with its own motion.


const stamp = (f      , x        , y        , rows          , map                        , cls         )       =>
  rows.forEach((row, dy) => [...row].forEach((ch, dx) => map[ch] && f(x + dx, y + dy, 1, 1, map[ch] ?? '', cls)))

// `wingUp` raises the front wing; `wingCls` lets it travel with the prop it holds.
const owlBody = (f      , wingUp = 0, wingCls         )       => {
  f(8, 8, 2, 1, PLUME); f(20, 8, 2, 1, PLUME)
  f(8, 9, 14, 13, PLUME); f(7, 10, 16, 11, PLUME)
  f(9, 11, 4, 4, WHITE); f(17, 11, 4, 4, WHITE)
  f(10, 12, 2, 2, INK); f(18, 12, 2, 2, INK)
  f(14, 14, 2, 2, BEAK)
  f(10, 16, 10, 5, BELLY)
  f(12, 17, 1, 1, SPOT); f(16, 17, 1, 1, SPOT); f(14, 19, 1, 1, SPOT); f(18, 19, 1, 1, SPOT)
  f(4, 14, 3, 5, PLUME)
  f(23, 14 + wingUp, 3, 5, PLUME, wingCls)
  f(10, 22, 1, 2, BEAK, 'la'); f(9, 24, 3, 1, BEAK, 'la')
  f(19, 22, 1, 2, BEAK, 'lb'); f(18, 24, 3, 1, BEAK, 'lb')
}

// Pure CSS, run by the compositor: no redraws. Periods divide one second, so the
// once-a-second redraw of a running row restarts them in phase. Every owl walks;
// each costume adds its prop's own motion on top.
const MASCOT_CSS = `<style>
.run .la{animation:st .5s steps(1) infinite}.run .lb{animation:st .5s steps(1) infinite -.25s}
.run .bd{animation:bob .5s steps(1) infinite -.125s}
.run g{transform-box:fill-box}
@keyframes st{50%{transform:translateY(-1px)}}@keyframes bob{50%{transform:translateY(1px)}}
.c-fable.run{animation:float 1s ease-in-out infinite}
.c-fable.run .la,.c-fable.run .lb,.c-fable.run .bd{animation:none}
.c-fable.run .ant{animation:blink 1s steps(1) infinite}
.c-fable.run .star{animation:blink .5s steps(1) infinite -.25s}
@keyframes float{50%{transform:translateY(-2px)}}@keyframes blink{50%{opacity:.15}}
.c-heavy.run .it{animation:scan 1s steps(1) infinite}
.c-heavy.run .gl{animation:blink 1s steps(1) infinite -.5s}
@keyframes scan{25%{transform:translate(-1px,1px)}50%{transform:translate(-2px,2px)}75%{transform:translate(-1px,1px)}}
.c-careful.run .it{transform-origin:100% 100%;animation:twist .5s ease-in-out infinite}
@keyframes twist{50%{transform:rotate(-35deg)}}
.c-medium.run .pan{transform-origin:0 50%;animation:tilt 1s ease-in-out infinite}
.c-medium.run .egg{animation:flip 1s ease-in-out infinite}
@keyframes tilt{20%,40%{transform:rotate(-12deg)}}@keyframes flip{30%{transform:translateY(-5px) scaleY(-1)}60%{transform:translateY(0)}}
.c-light.run .la{animation-duration:.25s}.c-light.run .lb{animation-duration:.25s;animation-delay:-.125s}
.c-light.run .flag{transform-origin:0 50%;animation:wave .25s steps(1) infinite}
@keyframes wave{50%{transform:skewY(-12deg) scaleX(.85)}}
.c-explore.run .it{transform-origin:50% 100%;animation:fence .5s ease-in-out infinite}
@keyframes fence{50%{transform:rotate(25deg)}}
.c-science.run .it{transform-origin:50% 100%;animation:swirl 1s ease-in-out infinite}
.c-science.run .bub{animation:fizz .5s steps(1) infinite}
@keyframes swirl{25%{transform:rotate(-8deg)}75%{transform:rotate(8deg)}}@keyframes fizz{50%{transform:translateY(-1px);opacity:.3}}
@media (prefers-reduced-motion: reduce){.run,.run g{animation:none!important}}
</style>`

const OUTFITS                                               = {
  // Fable: astronaut in a glass dome; floats instead of walking, the antenna and the star blink.
  fable: (f, t) => {
    owlBody(f)
    f(8, 6, 14, 1, '#E6E8EE'); f(6, 7, 2, 1, '#E6E8EE'); f(22, 7, 2, 1, '#E6E8EE')
    f(5, 8, 1, 14, '#E6E8EE'); f(24, 8, 1, 14, '#E6E8EE'); f(6, 22, 18, 1, '#C9CCD2')
    f(6, 7, 18, 15, 'rgba(169,214,245,.3)'); f(8, 8, 1, 3, '#fff')
    f(14, 3, 2, 3, '#C9CCD2'); f(14, 1, 2, 2, t, 'ant'); f(13, 20, 4, 1, t)
    f(27, 3, 1, 3, '#F5C542', 'star'); f(26, 4, 3, 1, '#F5C542', 'star')
  },
  // Heavy: detective in a check cap; the magnifier sweeps and glints.
  heavy: (f, t) => {
    owlBody(f, -4, 'it')
    stamp(f, 6, 3, ['......bbbbbb......', '....bbcbbcbbcb....', '...bbbbbbbbbbbb...', '...tttttttttttt...', '.dddddddddddddddd.', '.d..............d.'], { b: '#7A4A26', c: '#A0703F', d: '#5A3519', t })
    stamp(f, 24, 2, ['.kk.', 'k..k', 'k..k', '.kk.'], { k: '#3A3A3C' }, 'it')
    f(25, 3, 2, 2, 'rgba(169,214,245,.7)', 'it'); f(25, 6, 1, 4, '#7A4A26', 'it'); f(25, 3, 1, 1, '#fff', 'gl')
  },
  // Careful: engineer in a hard hat; the wrench turns a bolt.
  careful: (f, t) => {
    owlBody(f)
    stamp(f, 6, 4, ['......yyyyyy......', '....yyyyhhyyyy....', '...yyyyyhhyyyyy...', '...yyyyyhhyyyyy...', '.dddddddddddddddd.'], { y: '#F5C542', h: '#FBE08A', d: '#C99A1E' })
    f(10, 6, 2, 2, t)
    stamp(f, 3, 10, ['s.s', 'sss', '.s.', '.s.'], { s: '#8E929A' }, 'it')
  },
  // Medium: chef in a puffed hat; tosses the omelette.
  medium: (f, t) => {
    owlBody(f, -4, 'pan')
    stamp(f, 7, 3, ['...ww..ww..ww...', '..wwwwwwwwwwww..', '.wwwwgwwwwgwwww.', '.wwwwwwwwwwwwww.', '..wwwwwwwwwwww..', '..bbbbbbbbbbbb..', '..bbbbbbbbbbbb..'], { w: '#F4F3EE', g: '#D2D1C8', b: t })
    f(23, 8, 6, 1, '#4A4A48', 'pan'); f(24, 9, 1, 2, '#4A4A48', 'pan'); f(25, 7, 2, 1, '#F5B731', 'egg')
  },
  // Light: racer in a helmet; runs at double pace, the checkered flag flutters.
  light: (f, t) => {
    owlBody(f, -4)
    stamp(f, 6, 5, ['.....rrrrrrrr.....', '...rrrrwwrrrrrr...', '..rrrrrwwrrrrrrr..', '..rrrrrwwrrrrrrr..', '..kkkkkkkkkkkkkk..'], { r: t, w: '#F8F6F1', k: INK })
    f(26, 1, 1, 9, '#8E929A')
    stamp(f, 27, 1, ['wkw', 'kwk', 'wkw'], { w: '#F8F6F1', k: INK }, 'flag')
  },
  // Explore: pirate scouting the code; the cutlass fences.
  explore: f => {
    owlBody(f)
    stamp(f, 5, 4, ['........kkkk........', '.....kkkkkkkkkk.....', '..kkkkkkkwwkkkkkkk..', '.kkkkkkkkkkkkkkkkkk.', '..gggggggggggggggg..'], { k: '#55514C', w: '#F8F6F1', g: '#F5C542' })
    f(8, 10, 9, 1, INK); f(17, 11, 4, 4, INK)
    f(26, 6, 1, 9, '#C9CCD2', 'it'); f(25, 15, 3, 1, '#7A4A26', 'it')
  },
  // Scientist: lab coat and safety goggles; swirls a flask that fizzes.
  science: (f, t) => {
    owlBody(f, -4, 'it')
    f(7, 15, 4, 7, '#F4F3EE'); f(19, 15, 4, 7, '#F4F3EE')
    f(11, 15, 1, 3, '#D2D1C8'); f(18, 15, 1, 3, '#D2D1C8')
    f(8, 19, 2, 1, '#D2D1C8'); f(9, 17, 1, 2, t)
    f(7, 12, 1, 1, '#3A3A3C'); f(22, 12, 1, 1, '#3A3A3C'); f(14, 12, 2, 1, '#3A3A3C')
    stamp(f, 8, 10, ['kkkkkk', 'k....k', 'k....k', 'k....k', 'k....k', 'kkkkkk'], { k: '#3A3A3C' })
    stamp(f, 16, 10, ['kkkkkk', 'k....k', 'k....k', 'k....k', 'k....k', 'kkkkkk'], { k: '#3A3A3C' })
    f(9, 11, 4, 4, 'rgba(169,214,245,.3)'); f(17, 11, 4, 4, 'rgba(169,214,245,.3)')
    stamp(f, 24, 3, ['.ggg.', '..g..', '..g..', '.glg.', 'glllg', 'glllg', 'ggggg'], { g: '#DCE6EC', l: t }, 'it')
    f(26, 1, 1, 1, t, 'bub'); f(27, 0, 1, 1, t, 'bub')
  },
  other: f => owlBody(f),
}

const MASCOT_BOX = 30
const MASCOT_SCALE = 1.1

// Body and props nest inside `bd` so a prop rides the bob and adds its own motion;
// feet stay outside it and step on their own. `mirror` flips the owl inside its
// own box (x .. x + MASCOT_BOX * scale) so it faces left.
const mascot = (x        , y        , costume        , dim = false, isWalking = false, scale = MASCOT_SCALE, mirror = false)         => {
  const groups = new Map                  ([['bd', []]])
  const f       = (cx, cy, w, h, c, cls = 'bd') => {
    if (!groups.has(cls)) groups.set(cls, [])
    groups.get(cls)?.push(`<rect x="${cx}" y="${cy}" width="${w}" height="${h}" fill="${c}"/>`)
  }
  const draw = OUTFITS[costume] ?? ((g      ) => owlBody(g))
  draw(f, colorOf(costume))
  const group = (cls        ) => `<g class="${cls}">${(groups.get(cls) ?? []).join('')}</g>`
  const props = [...groups.keys()].filter(k => k !== 'bd' && k !== 'la' && k !== 'lb')
  const body = `<g class="bd">${(groups.get('bd') ?? []).join('')}${props.map(group).join('')}</g>`
  const place = mirror ? `translate(${x + MASCOT_BOX * scale},${y}) scale(${-scale},${scale})` : `translate(${x},${y}) scale(${scale})`
  return `<g transform="${place}" opacity="${dim ? 0.45 : 1}" shape-rendering="crispEdges"><g class="c-${costume}${isWalking ? ' run' : ''}">${body}${group('la')}${group('lb')}</g></g>`
}

// The drawing helpers below were written for the earlier mascot and keep its names.
const CRAB_CSS = MASCOT_CSS, CRAB_BOX = MASCOT_BOX, crab = mascot

// ---------- Words and numbers

const cleanName = (value        )         => value.replace(/\s+/g, ' ').trim().slice(0, 28) || DEFAULT_NAME

const fmtTokens = (n        )         => {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}k`
  return String(Math.round(n))
}
const plural = (n        , word        ) => `${n} ${word}${n === 1 ? '' : 's'}`
const replyWord = (n        ) => `${n} repl${n === 1 ? 'y' : 'ies'}`
const mmss = (ms        ) => {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
const resetWords = (iso        , at        )         => {
  const t = Date.parse(iso)
  if (!Number.isFinite(t) || !iso) return ''
  const ms = t - at
  if (ms <= 0) return 'resetting'
  const h = Math.floor(ms / ONE_H)
  if (h >= 24) return `resets ${Math.floor(h / 24)}d ${h % 24}h`
  if (h >= 1) return `resets ${h}h ${Math.floor((ms % ONE_H) / 60_000)}m`
  return `resets ${Math.ceil(ms / 60_000)}m`
}
const agoWords = (ms        ) => {
  const m = Math.floor(ms / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  return h < 24 ? `${h} h ago` : `${Math.floor(h / 24)} d ago`
}
const xml = (s        ) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const baseName = (path        ) => path.split(/[\\/]/).filter(Boolean).pop() ?? path
const shortLabel = (label        ) => (/^[/~]/.test(label) ? baseName(label) : label).slice(0, 60)
const modelName = (id        )         => {
  const m = /(fable|mythos|opus|sonnet|haiku)-(\d+)(?:-(\d{1,2})(?!\d))?/i.exec(id)
  if (!m) return id || 'Claude'
  const family = m[1] ?? ''
  return `${family[0]?.toUpperCase() ?? ''}${family.slice(1)} ${m[2]}${m[3] ? `.${m[3]}` : ''}`
}
const friendlyTool = (tool        )         => {
  if (!tool.startsWith('mcp__')) return tool
  const [, server = '', name = ''] = tool.split('__')
  return `${server.replace(/^plugin_[^_]*_/, '')}: ${name.replace(/_/g, ' ')}`
}
// Tool names mean little to most people: what Claude did, in plain words.
const JOBS                         = {
  Read: 'Read a file', Edit: 'Edited a file', MultiEdit: 'Edited a file', NotebookEdit: 'Edited a file', Write: 'Wrote a file',
  Grep: 'Searched inside files', Glob: 'Looked for files', WebSearch: 'Searched online', WebFetch: 'Opened a web page',
  Bash: 'Ran a command', Agent: 'Started a helper', Task: 'Started a helper', Skill: 'Used a skill', AskUserQuestion: 'Asked you a question', Artifact: 'Made a page',
}
const APPS                     = [[/chrome/i, 'Chrome'], [/browser/i, 'the browser'], [/gmail/i, 'Gmail'], [/calendar/i, 'Calendar'], [/drive/i, 'Google Drive'], [/sheets/i, 'Google Sheets'], [/docs/i, 'Google Docs'], [/slack/i, 'Slack'], [/notion/i, 'Notion'], [/figma/i, 'Figma'], [/linear/i, 'Linear']]
const appName = (server        )         => {
  const named = APPS.find(([re]) => re.test(server))?.[1]
  if (named) return named
  if (/^[0-9a-f]{8}-/i.test(server)) return 'a connected app'
  return server.replace(/^plugin_[^_]*_/, '').replace(/[-_]/g, ' ')
}
// The app's own housekeeping and tool lookups are not jobs anyone asked for.
const isHousekeeping = (tool        )          => /usage[-_]desk|Claude_Browser__(preview_start|request_access)|^mcp__(ccd_|plugin-authoring|terminal__read)/i.test(tool) || /^(ToolSearch|TodoWrite|TaskCreate|TaskUpdate|TaskList|TaskGet|Monitor|ListAgents)$/.test(tool)
const jobOf = (tool        )         => {
  if (JOBS[tool]) return JOBS[tool]          
  if (tool.startsWith('mcp__')) return `Used ${appName(tool.split('__')[1] ?? '')}`
  return `Used ${tool}`
}
const WORK                         = { Read: 'Reading files', Bash: 'Running commands', WebFetch: 'Opening web pages', WebSearch: 'Searching online', Grep: 'Searching inside files', Glob: 'Looking for files', Skill: 'Using skills', Agent: 'Starting helpers', Edit: 'Editing files', Write: 'Writing files' }
const workOf = (tool        )         => WORK[tool] ?? (tool.startsWith('mcp__') ? jobOf(tool) : tool)
const jobSummary = (counts                        )         => {
  const total                         = {}
  for (const [tool, n] of Object.entries(counts)) {
    if (isHousekeeping(tool)) continue
    const job = jobOf(tool)
    total[job] = (total[job] ?? 0) + n
  }
  return Object.entries(total).sort((x, y) => y[1] - x[1]).slice(0, 6).map(([job, n]) => `${job} × ${n}`).join(' · ')
}

const connectorOf = (tool        )         => (tool.startsWith('mcp__') ? (tool.split('__')[1] ?? '') : '')

// The label a tool call gets in the live list. Paths and searches, never file contents.
const labelOf = (e                         )         => {
  for (const key of ['file_path', 'path', 'notebook_path', 'url', 'query', 'pattern', 'description', 'skill', 'command']) {
    const v = e[key]
    if (typeof v === 'string' && v) return shortLabel(v.split('\n')[0] ?? '')
  }
  return ''
}

// /context names its colours by theme key; a drawing needs real ones.
const THEME                         = {
  promptBorder: '#888780', inactive: '#6B6B66', permission: '#7F77DD', planMode: '#1D9E75', autoAccept: '#A06CD5',
  warning: '#D9A441', success: '#3B9C5F', error: '#D0453F', claude: '#D97757', suggestion: '#378ADD', bashBorder: '#D45D9B',
  ide: '#4F86C6', remember: '#378ADD', fastMode: '#E07B39', text: '#B5B5B0', subtle: '#9A9A96', secondaryText: '#9A9A96',
  merged: '#A06CD5', professionalBlue: '#378ADD', chromeYellow: '#D9A441',
}
const SPARE = ['#D97757', '#378ADD', '#1D9E75', '#7F77DD', '#D9A441', '#D45D9B', '#4F86C6', '#A06CD5']
const hexOf = (key        )         => {
  if (key.startsWith('#')) return key
  if (THEME[key]) return THEME[key]          
  let h = 0
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) % 997
  return SPARE[h % SPARE.length]          
}

// The Context side panel's colours, so the two read the same.
const CATEGORY                     = [
  [/server instructions/i, '#8E8E8A'],
  [/message/i, '#3B82F6'],
  [/system tools/i, '#EA6A2A'],
  [/mcp tools/i, '#10B981'],
  [/system prompt/i, '#E09F1F'],
  [/skill/i, '#B8B8B4'],
  [/memory/i, '#A06CD5'],
  [/agent/i, '#D45D9B'],
  [/buffer|compact/i, '#6F6F6B'],
  [/free/i, '#3A3A38'],
]
const categoryColor = (name        )         => CATEGORY.find(([re]) => re.test(name))?.[1] ?? hexOf(name)
const categoryRank = (c          )         => (c.kind === 'free' ? 2 : c.kind === 'buffer' ? 1 : 0)
const categoryOrder = (x          , y          )         => categoryRank(x) - categoryRank(y) || y.tokens - x.tokens

// List prices per million tokens (input, output, cache read, 1-hour cache write), checked 2026-11-05.
const PRICES                                               = [
  [/(fable|mythos)-5-1/, [10, 50, 0.25, 20]],
  [/fable|mythos/, [10, 50, 1, 20]],
  [/opus-5-5/, [4, 20, 0.2, 8]],
  [/opus/, [5, 25, 0.5, 10]],
  [/sonnet-5-5/, [2, 10, 0.1, 4]],
  [/sonnet-5/, [2, 10, 0.2, 4]],
  [/sonnet/, [3, 15, 0.3, 6]],
  [/haiku-5-5/, [0.1, 0.5, 0.01, 0.2]],
  [/haiku/, [1, 5, 0.1, 2]],
]
const HAIKU_LONG = [0.5, 2.5, 0.05, 1]
const costOf = (model        , t                                                                          )         => {
  // Haiku 5.5 costs more on a request whose prompt is over 100,000 tokens, which every Cowork request is.
  const prompt = t.requests ? (t.input + t.cacheRead + t.cacheWrite) / t.requests : 0
  const q = /haiku-5-5/.test(model) && prompt > 100000 ? HAIKU_LONG : PRICES.find(([re]) => re.test(model))?.[1] ?? [4, 20, 0.2, 8]
  return (t.input * q[0] + t.output * q[1] + t.cacheRead * q[2] + t.cacheWrite * q[3]) / 1e6
}
const fmtCost = (usd        )         => `$${usd >= 100 ? Math.round(usd) : usd.toFixed(2)}`
const clockTime = (ms        )         => {
  const sec = Math.floor(ms / 1000)
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}` : `${m}:${String(sec % 60).padStart(2, '0')}`
}


// ---------- Explanations, written from what was measured

                                                                                       
                                                                                                    


// Every reply re-reads the whole chat, so what matters is its size, not its share of the window.
const BIG_CHAT = 150_000
// Cowork starts every task with a lot of its own text, so only what the task added counts here.
const addedByTask = s => { const c = s.scan?.chat; return c ? c.yourTokens + c.claudeTokens + c.thinkingTokens + c.toolInputTokens + c.toolResultTokens : 0 }
const isBigChat = s => addedByTask(s) >= 100_000 || s.chatPercent >= 50

function explain(name        , tokens        , s          )      {
  const c = s.scan?.chat
  const b = s.breakdown
  const low = name.toLowerCase()
  const percent = s.chatWindow ? Math.round((tokens / s.chatWindow) * 100) : 0
  const lead = `${fmtTokens(tokens)} tokens, ${percent}% of this task's space.`
  const isBig = isBigChat(s)
  if (low.includes('message') && c) {
    const avg = c.replies ? Math.round(c.cacheRead / c.replies) : 0
    const total = c.yourTokens + c.claudeTokens + c.thinkingTokens + c.toolInputTokens + c.toolResultTokens + c.appTokens
    const top = [
      { n: 'Results of jobs', v: c.toolResultTokens },
      { n: 'Job requests', v: c.toolInputTokens },
      { n: 'Your messages', v: c.yourTokens },
      { n: "Claude's replies", v: c.claudeTokens },
      { n: 'Thinking', v: c.thinkingTokens },
      { n: 'Setup and reminders from Cowork', v: c.appTokens },
    ].sort((x, y) => y.v - x.v)
    const main = top[0]
    const lines = [
      lead,
      `This task holds ${plural(c.yourMessages, 'message')} from you and ${plural(c.toolCalls, 'job')} Claude did. Claude re-reads all of it on every reply, about ${fmtTokens(avg)} tokens each time, across ${replyWord(c.replies)} so far.`,
    ]
    if (main && total) lines.push(`The biggest part is ${main.n.toLowerCase()}, about ${Math.round((main.v / total) * 100)}%. These parts are estimates and will not add up exactly to the total.`)
    if (c.coldRebuilds) lines.push(`The cache went cold ${plural(c.coldRebuilds, 'time')}, which rewrote ${fmtTokens(c.coldTokens)} tokens at the higher price.`)
    const fixes        = []
    if (isBig) fixes.push({ key: 'compact', label: 'Compact now', act: 'compact' }, { key: 'handoff', label: 'Draft a handoff', act: 'handoff' })
    else lines.push(`Nothing to fix yet. Compacting pays off more once a task passes about ${fmtTokens(BIG_CHAT)} tokens.`)
    return { lines, fixes, rows: [...top.map(t => ({ name: t.n, value: `~${fmtTokens(t.v)}` })), ...c.largest.slice(0, 4).map(l => ({ name: `${workOf(l.tool)}${l.label ? ` · ${shortLabel(l.label)}` : ''}`, value: `~${fmtTokens(l.tokens)}`, note: 'largest' }))] }
  }
  if (low.includes('mcp') && b) {
    return {
      lines: [lead, `${plural(b.mcp.length, 'connector')} loaded tool descriptions here, and they are re-read on every reply even when unused. Turn off the ones this task does not need.`],
      fixes: [],
      rows: [...b.mcp].sort((x, y) => y.tokens - x.tokens).map(m => ({ name: m.name, value: fmtTokens(m.tokens), note: m.detail })),
    }
  }
  if (low.includes('memory') && b) {
    return { lines: [lead, 'These instruction files load into every task, so trimming them saves tokens everywhere.'], fixes: [], rows: [...b.memory].sort((x, y) => y.tokens - x.tokens).map(m => ({ name: m.name, value: fmtTokens(m.tokens), note: m.detail })) }
  }
  if (low.includes('skill') && b) {
    return { lines: [lead, 'Each installed skill adds a short description here. Disabling plugins you never use shrinks it.'], fixes: [], rows: [...b.skills].sort((x, y) => y.tokens - x.tokens).slice(0, 12).map(m => ({ name: m.name, value: fmtTokens(m.tokens) })) }
  }
  if (low.includes('agent') && b) {
    return { lines: [lead, 'Descriptions of the agent types Claude can start.'], fixes: [], rows: [...b.agents].sort((x, y) => y.tokens - x.tokens).map(m => ({ name: m.name, value: fmtTokens(m.tokens) })) }
  }
  if (low.includes('free')) return { lines: [`${fmtTokens(tokens)} tokens are still free in this task.`], fixes: [], rows: [] }
  if (low.includes('buffer') || low.includes('compact')) return { lines: [lead, 'Space held back so Claude can summarise the task when it fills up. You cannot use it for messages.'], fixes: [], rows: [] }
  if (low.includes('system prompt')) return { lines: [lead, "Claude's built-in instructions. They load in every task and you cannot trim them."], fixes: [], rows: [] }
  if (low.includes('tool')) return { lines: [lead, 'Descriptions of the built-in tools. They load in every task and you cannot trim them.'], fixes: [], rows: [] }
  return { lines: [lead], fixes: [], rows: [] }
}

// Why one reply or one job took the tokens it did, from that request's own figures.
function explainRow(row             )           {
  const lines           = []
  const reread = row.reread > 0 ? `To do this, Claude also re-read ${fmtTokens(row.reread)} tokens of the task from the cache. Those re-reads cost far less per token than new text, but they repeat on every reply.` : ''
  if (row.kind === 'reply') {
    const written = row.tokens - row.thinking
    lines.push(row.thinking > 0 ? `Claude produced ${fmtTokens(row.tokens)} tokens: about ${fmtTokens(written)} of writing and ${fmtTokens(row.thinking)} of thinking first.` : `Claude wrote ${fmtTokens(row.tokens)} tokens for this reply.`)
    if (row.fresh > 0) lines.push(`${fmtTokens(row.fresh)} tokens were new to the task at that point, such as your message and any job results.`)
    if (reread) lines.push(reread)
    if (row.thinking > written && row.thinking > 200) lines.push('Most of this was thinking. A lower effort setting usually means less of it.')
  } else {
    const job = jobOf(row.tool).toLowerCase()
    lines.push(`About ${fmtTokens(row.tokens)} tokens went into the task when Claude ${job}. That counts the request and what came back. It is an estimate from the text's length.`)
    lines.push('It stays in the task, so Claude re-reads it on every later reply until the task is compacted.')
    if (reread) lines.push(reread)
    if (row.tokens > 5000) lines.push(row.tool === 'Read' ? 'This is a big file. Pointing Claude to the part you need would use less.' : 'This is a big result. Asking for something narrower would use less.')
    if (row.isError) lines.push('This job failed, so those tokens brought nothing useful back.')
  }
  return lines
}

function explainFiles(s          )      {
  const c = s.scan?.chat
  if (!c) return { lines: ['No log for this task yet.'], fixes: [], rows: [] }
  const repeat = c.files.filter(f => f.reads > 1)
  const lines = [`Claude read ${plural(c.files.length, 'file')} here, and every file stays in the task and is re-read on each reply.`]
  if (repeat[0]) lines.push(`${baseName(repeat[0].path)} was read ${repeat[0].reads} times. Pointing Claude to the part you need avoids that.`)
  return { lines, fixes: [], rows: c.files.map(f => ({ name: baseName(f.path), value: `~${fmtTokens(f.tokens)}`, note: plural(f.reads, 'read') })) }
}

function explainTools(s          )      {
  const c = s.scan?.chat
  if (!c) return { lines: ['No log for this task yet.'], fixes: [], rows: [] }
  const rows = [...c.tools, ...c.connectors.filter(x => !x.name.startsWith('ccd_')).map(x => ({ ...x, name: `Used ${appName(x.name)}` }))].sort((x, y) => y.tokens - x.tokens)
  const top = rows[0]
  const lines = [`What Claude's jobs brought back takes about ${fmtTokens(c.toolResultTokens)} tokens, and it stays in the task after the job ends.`]
  if (top) lines.push(`${workOf(top.name)} added the most.`)
  return { lines, fixes: [], rows: rows.map(t => ({ name: workOf(t.name), value: `~${fmtTokens(t.tokens)}`, note: plural(t.calls, 'time') })) }
}

function explainWindow(w            , chat         )           {
  const avg = chat.replies ? Math.round((chat.cacheRead + chat.input) / chat.replies) : 0
  const lines = [`About ${chat.share}% of the usage tracked in this window. ${replyWord(chat.replies)}, re-reading about ${fmtTokens(avg)} tokens each.`]
  const parts = [
    { n: 're-reading the task from cache', v: chat.cacheRead * 0.05 },
    { n: 'saving new content to the cache', v: chat.cacheWrite * 2 },
    { n: "Claude's replies", v: chat.output * 5 },
    { n: 'uncached input', v: chat.input },
  ].sort((x, y) => y.v - x.v)
  if (parts[0]) lines.push(`Its biggest cost is ${parts[0].n}.`)
  if (w.chatCount > 15) lines.push(`Showing the top 15 of ${w.chatCount} chats.`)
  return lines
}


// ---------- Drawing helpers (the look follows savvy-progress)

const barWidth = (e                                     ) => Math.max(220, Math.min(900, (e.props.bodyColumns || 40) * 8 - 8))

const PANE_CSS = `<style>
.t{fill:var(--text)}.s{fill:var(--dim)}.m{fill:var(--mute)}.k{fill:var(--track)}.ln{stroke:var(--line)}.tile{fill:var(--fill)}
.live{animation:p 1.6s ease-in-out infinite}@keyframes p{50%{opacity:.3}}
@media (prefers-reduced-motion: reduce){.live{animation:none}}
</style>`

const textWidth = (s        , size        )         => [...s].reduce((w, ch) => w + (/[iljtf.,:;·' ]/.test(ch) ? 0.3 : /[A-Z%mw]/.test(ch) ? 0.72 : 0.54) * size, 0)
const fitText = (s        , size        , maxW        )         => {
  if (textWidth(s, size) <= maxW) return s
  let out = ''
  for (const ch of s) {
    if (textWidth(`${out}${ch}…`, size) > maxW) break
    out += ch
  }
  return `${out}…`
}
const svg = (W        , H        , body        )         => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${xml(FONT)}">${PANE_CSS}${CRAB_CSS}${body}</svg>`
const txt = (cls        , x        , y        , size        , words        , extra = '') => `<text class="${cls}" x="${x}" y="${y}" font-size="${size}" ${extra}>${xml(words)}</text>`
const num = 'font-variant-numeric="tabular-nums"'

const thinBar = (id        , x        , y        , w        , h        , segments                                    )         => {
  let at = x
  const rects = segments
    .map(s => {
      const width = Math.max(0, Math.min(x + w - at, (s.share / 100) * w))
      const r = `<rect x="${at.toFixed(1)}" y="${y}" width="${width.toFixed(1)}" height="${h}" fill="${s.color}"/>`
      at += width
      return r
    })
    .join('')
  return `<defs><clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}"/></clipPath></defs><g clip-path="url(#${id})"><rect class="k" x="${x}" y="${y}" width="${w}" height="${h}"/>${rects}</g>`
}

const statusMark = (x        , y        , status        , color        )         => {
  if (status === 'running') return `<circle class="live" cx="${x}" cy="${y}" r="3.5" fill="${color}"/>`
  if (status === 'done') return `<path d="M${x - 5} ${y}l3.5 3.5 6.5-7" fill="none" stroke="${GOOD}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`
  if (status === 'failed') return `<path d="M${x - 4} ${y - 4}l8 8M${x + 4} ${y - 4}l-8 8" stroke="${BAD}" stroke-width="1.8" stroke-linecap="round"/>`
  return ''
}

                                                                                                                                                                                               
const AGENT_H = 66
const agentSvg = (W        , a           )         => {
  const textW = W - 42 - 22
  const tagText = fitText(a.tag, 11, textW)
  const metaX = 42 + textWidth(tagText, 11) + 8
  return svg(
    W,
    AGENT_H,
    `${crab(0, 14, a.look, false, a.isWalking, 1.1)}
${txt('t', 42, 18, 13, fitText(a.title, 13, textW), 'font-weight="600"')}
<text x="42" y="34" font-size="11" fill="${a.tagColor}">${xml(tagText)}</text>${a.meta ? txt('s', metaX, 34, 11, fitText(a.meta, 11, W - metaX - 8)) : ''}
${a.left ? txt('t', 42, 49, 11, fitText(a.left, 11, Math.max(0, textW - textWidth(a.stats, 11) - 8)), num) : ''}
${txt('s', 42 + textW, 49, 11, a.stats, `text-anchor="end" ${num}`)}
${thinBar(`a${Math.abs(hash(a.title))}`, 42, 55, textW, 4, [{ color: a.barColor, share: a.ratio * 100 }])}
${statusMark(W - 8, 16, a.status, a.barColor)}
<line class="ln" x1="0" y1="65.5" x2="${W}" y2="65.5"/>`,
  )
}

const hash = (s        ) => [...s].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 99991, 7)

const USAGE_H = 54
const usageSvg = (W        , u                                                                                                                                          )         => {
  const valueW = textWidth(u.value, 13) + 4
  return svg(
    W,
    USAGE_H,
    `${txt('m', 0, 17, 10, u.isOpen ? '▾' : '▸')}
${txt('t', 14, 18, 13, fitText(u.title, 13, W - valueW - 24), 'font-weight="600"')}
${txt('t', W, 18, 13, u.value, `text-anchor="end" font-weight="600" ${num}`)}
${txt('s', 14, 34, 11, fitText(u.meta, 11, W - 14 - textWidth(u.right, 11) - 8), num)}
${txt('s', W, 34, 11, u.right, `text-anchor="end" ${num}`)}
${thinBar(`u${u.id}`, 0, 42, W, 5, u.segments)}`,
  )
}

const CRAB_W = 92
const HERO_HEAD_H = 34
const HERO_BAR_H = 36
const heroCrabSvg = (look        , isWalking         )         =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${CRAB_W}" height="88" viewBox="0 0 ${CRAB_W} 88">${CRAB_CSS}${crab(1, 2, look, false, isWalking, 3)}</svg>`
const heroHeadSvg = (W        , name        , model        , isWorking         )         =>
  svg(W, HERO_HEAD_H, `${txt('t', 0, 14, 14, fitText(name, 14, W - 16), 'font-weight="600"')}<text x="0" y="29" font-size="11" fill="#D97757">${xml(model)}</text>${txt('s', textWidth(model, 11) + 8, 29, 11, isWorking ? 'Working' : 'Idle')}${isWorking ? statusMark(W - 6, 10, 'running', '#D97757') : ''}`)
const heroBarSvg = (W        , b                                                                                                                           )         => {
  const valueW = textWidth(b.value, 12) + 4
  const titleW = textWidth(b.title, 12) + 13
  return svg(
    W,
    HERO_BAR_H,
    `${txt('m', 0, 14, 8, b.isOpen ? '▾' : '▸')}${txt('t', 10, 15, 12, b.title, 'font-weight="600"')}${txt('s', 10 + titleW - 8, 15, 10, fitText(b.note, 10, Math.max(0, W - titleW - valueW - 6)), num)}${txt('t', W, 15, 12, b.value, `text-anchor="end" font-weight="600" ${num}`)}
${thinBar(`h${b.id}`, 0, 22, W, 6, b.segments)}`,
  )
}

const TILE_H = 44
const tilesSvg = (W        , tiles                            )         => {
  const gap = 6
  const tw = (W - gap * (tiles.length - 1)) / tiles.length
  return svg(
    W,
    TILE_H,
    tiles
      .map((t, i) => {
        const x = i * (tw + gap)
        return `<rect class="tile" x="${x}" y="0" width="${tw}" height="40" rx="8"/>${txt('s', x + 9, 16, 11, t.k)}${txt('t', x + 9, 33, 15, fitText(t.v, 15, tw - 14), `font-weight="600" ${num}`)}`
      })
      .join(''),
  )
}

const LINE_H = 26
const legendSvg = (W        , color        , name        , value        , share        )         =>
  svg(W, LINE_H, `<rect x="0" y="7" width="11" height="11" rx="2.5" fill="${color}"/>${txt('t', 19, 17, 12, fitText(name, 12, W - 112))}${txt('s', W - 46, 17, 12, value, `text-anchor="end" ${num}`)}${txt('s', W, 17, 12, share, `text-anchor="end" ${num}`)}`)

const JOB_H = 28
const jobSvg = (W        , color        , name        , value        , isOpen         )         =>
  svg(W, JOB_H, `<rect x="0" y="9" width="9" height="9" rx="2" fill="${color}"/>${txt('t', 16, 18, 12, fitText(name, 12, W - 16 - 66))}${txt('s', W - 11, 18, 12, value, `text-anchor="end" ${num}`)}${txt('m', W, 17, 8, isOpen ? '▾' : '▸', 'text-anchor="end"')}<line class="ln" x1="0" y1="27.5" x2="${W}" y2="27.5"/>`)

const CHAT_H = 50
const chatSvg = (W        , c         , color        , at        )         =>
  svg(
    W,
    CHAT_H,
    `${txt('t', 0, 16, 13, fitText(c.title, 13, W - 56), 'font-weight="600"')}${txt('t', W, 16, 13, `${c.share}%`, `text-anchor="end" font-weight="600" ${num}`)}
${txt('s', 0, 32, 11, fitText(`${c.project} · ${replyWord(c.replies)} · ${agoWords(at - c.lastAt)}`, 11, W))}
${thinBar(`c${Math.abs(hash(c.id))}`, 0, 39, W, 4, [{ color, share: c.share }])}
<line class="ln" x1="0" y1="49.5" x2="${W}" y2="49.5"/>`,
  )

const LOOK_H = 44
const lookSvg = (W        , look        , name        , isCurrent         )         =>
  svg(W, LOOK_H, `${crab(0, 6, look, false, true, 1.1)}${txt('t', 42, 26, 13, name, isCurrent ? 'font-weight="600"' : '')}${isCurrent ? statusMark(W - 8, 22, 'done', GOOD) : ''}<line class="ln" x1="0" y1="43.5" x2="${W}" y2="43.5"/>`)

const gridSvg = (W        , grid                   )                                     => {
  const cols = grid[0]?.length ?? 1
  const gap = 3
  const cell = Math.min(16, Math.floor((W - gap * (cols - 1)) / cols))
  const height = grid.length * (cell + gap)
  const body = grid
    .flatMap((row, y) =>
      row.map((s, x) => {
        const color = categoryColor(s.name)
        const px = x * (cell + gap)
        const py = y * (cell + gap)
        if (!s.isFilled || /free/i.test(s.name)) return `<rect class="k" x="${px}" y="${py}" width="${cell}" height="${cell}" rx="2"/>`
        return s.fullness < 0.7
          ? `<rect x="${px + 0.5}" y="${py + 0.5}" width="${cell - 1}" height="${cell - 1}" rx="2" fill="none" stroke="${color}"/>`
          : `<rect x="${px}" y="${py}" width="${cell}" height="${cell}" rx="2" fill="${color}"/>`
      }),
    )
    .join('')
  return { source: svg(W, height, body), height }
}

const tokenSegments = (t                                                                          ) => {
  const total = t.input + t.output + t.cacheWrite + t.cacheRead || 1
  return [
    { label: 'Claude replies', tokens: t.output, color: '#D97757' },
    { label: 'New context', tokens: t.input + t.cacheWrite, color: '#378ADD' },
    { label: 'Re-read from cache', tokens: t.cacheRead, color: '#888780' },
  ].map(s => ({ ...s, share: (s.tokens / total) * 100 }))
}

const lookOf = (a          ) => (a.type === 'Explore' ? 'explore' : /fable|mythos/.test(a.model) ? 'fable' : /opus/.test(a.model) ? 'heavy' : /sonnet/.test(a.model) ? 'medium' : /haiku/.test(a.model) ? 'light' : 'other')
const TIER                         = { fable: '#7F77DD', heavy: '#D85A30', medium: '#378ADD', light: '#1D9E75', explore: '#1D9E75', other: '#888780' }


