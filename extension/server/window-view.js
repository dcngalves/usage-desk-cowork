// Draws the window from the latest figures. The layout follows the Usage Desk mod's panel.
(function () {
  // The page that loads this file says how figures are read and buttons are sent.
  const T = window.usageDeskTransport
  const root = document.getElementById('root')
  const p = { open: '', detail: '', task: '', confirm: '', sent: '', showActivity: true, showLooks: false, job: '', moreJobs: false, isRenaming: false }
  let data = null
  let isConnected = false
  let handlers = []
  let lastHtml = ''
  let problem = ''

  // A quiet action is a nicety the page asks for by itself, never one the person pressed.
  const act = (action, isQuiet = false) => {
    if (!data?.task) return
    Promise.resolve(T.act(data.task.id, action, isQuiet)).catch(error => {
      p.sent = T.explain ? T.explain(error) : 'That did not go through.'
      draw()
    })
  }
  const set = patch => {
    Object.assign(p, patch, { confirm: '', sent: '' })
    draw()
  }

  // ---------- Pieces of the page

  const press = (name, html, alt, run) => {
    handlers.push(run)
    return `<div class="press" role="button" tabindex="0" aria-label="${xml(alt)}" data-p="${handlers.length - 1}" data-k="${xml(name)}">${html}</div>`
  }
  const button = (name, label, run, cls = '') => {
    handlers.push(run)
    return `<button class="${cls}" data-p="${handlers.length - 1}" data-k="${xml(name)}">${xml(label)}</button>`
  }
  const para = (words, cls = '') => `<p class="${cls}">${xml(words)}</p>`
  const row = (name, value, note, color) => `<div class="row"><span class="name">${color ? `<span class="dot" style="background:${xml(color)}"></span>` : ''}${xml(name)}${note ? `<span class="note">${xml(note)}</span>` : ''}</span><span class="value">${xml(value)}</span></div>`
  const stack = (...parts) => `<div class="stack">${parts.join('')}</div>`
  const section = (...parts) => `<div class="section">${parts.join('')}</div>`
  const back = onPress => button('back', '‹ Back', onPress, 'plain')

  function why(title, y) {
    return section(
      back(() => set({ detail: '' })),
      `<p><b>${xml(title)}</b></p>`,
      ...y.lines.map(line => para(line)),
      y.rows.length ? stack(...y.rows.map(r => row(r.name, r.value, r.note))) : '',
      y.fixes.length ? `<div class="inline">${y.fixes.map(fix => fixButton(fix)).join('')}</div>` : '',
    )
  }

  function fixButton(fix) {
    if (fix.act !== 'none' && !data.task?.state?.link?.isOpen) return ''
    if (fix.act === 'compact') {
      const isAsking = p.confirm === 'compact'
      return button(`fix-${fix.key}`, isAsking ? 'Confirm: compact this task' : fix.label, () => {
        if (!isAsking) {
          p.confirm = 'compact'
          p.sent = ''
        } else {
          act('compact')
          p.confirm = ''
          p.sent = 'Asked the task to compact.'
        }
        draw()
      }, isAsking ? 'primary' : '')
    }
    return button(`fix-${fix.key}`, fix.label, () => {
      act(fix.act)
      p.sent = 'Asked the task.'
      draw()
    })
  }

  function chatSection(s, W) {
    const b = s.breakdown
    if (!b) return para("The breakdown appears after Claude's first reply.", 'dim')
    if (p.detail === 'files') return why('Files read', explainFiles(s))
    if (p.detail === 'tools') return why('Results of jobs', explainTools(s))
    const picked = b.categories.find(x => x.name === p.detail)
    if (picked) return why(picked.name, explain(picked.name, picked.tokens, s))
    const g = gridSvg(W, b.grid)
    const sc = s.scan?.chat
    const pct = n => (s.chatWindow ? `${((n / s.chatWindow) * 100).toFixed(1)}%` : '')
    return section(
      b.grid.length ? g.source : '',
      stack(
        ...[...b.categories].sort(categoryOrder).map(x => press(`cat-${x.name}`, legendSvg(W, categoryColor(x.name), x.name, fmtTokens(x.tokens), pct(x.tokens)), `${x.name} ${fmtTokens(x.tokens)}`, () => set({ detail: x.name }))),
        sc && sc.files.length ? press('d-files', legendSvg(W, '#888780', 'Files read', String(sc.files.length), ''), `Files read ${sc.files.length}`, () => set({ detail: 'files' })) : '',
        sc && sc.toolResultTokens ? press('d-tools', legendSvg(W, '#888780', 'Results of jobs', `~${fmtTokens(sc.toolResultTokens)}`, ''), `Results of jobs ${fmtTokens(sc.toolResultTokens)}`, () => set({ detail: 'tools' })) : '',
      ),
      s.chatTokens > addedByTask(s) ? para(`About ${fmtTokens(s.chatTokens - addedByTask(s))} of this is Cowork's own setup, there before your first message. Every reply re-reads it from the cache.`, 'dim') : '',
      sc ? para(`Whole task so far: ${fmtTokens(sc.output)} written by Claude, ${fmtTokens(sc.input + sc.cacheWrite)} new context, ${fmtTokens(sc.cacheRead)} re-read from cache.`, 'dim') : '',
    )
  }

  // The 5-hour and weekly sections: which Cowork tasks the tracked usage came from.
  function windowSection(name, limit, length, color, at, W) {
    const resetAt = limit?.resetsAt ? Date.parse(limit.resetsAt) : NaN
    const start = Number.isFinite(resetAt) && resetAt > at ? resetAt - length : at - length
    const tasks = data.tasks.filter(t => t.tokens > 0 && t.updatedAt >= start)
    const costed = tasks.map(t => { const list = Object.entries(t.steps ?? {}); return { ...t, cost: t.isMeasured && list.length ? list.reduce((n, [model, row]) => n + costOf(model, row), 0) : t.chatCost } })
    const totalCost = costed.reduce((sum, t) => sum + t.cost, 0) || 1
    const rows = costed.map(t => ({ ...t, title: t.title || `Task started ${new Date(t.startedAt).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}`, project: 'Cowork', lastAt: t.updatedAt, share: Math.round((t.cost / totalCost) * 100) }))
    const picked = rows.find(t => t.id === p.task)
    if (picked) {
      return section(
        back(() => set({ task: '' })),
        `<p><b>${xml(picked.title)}</b></p>`,
        para(`Last active ${agoWords(at - picked.lastAt)}`, 'dim'),
        ...explainWindow({ chatCount: rows.length }, picked).map(t => para(t)),
        stack(...tokenSegments(picked).map(x => row(x.label, fmtTokens(x.tokens), '', x.color))),
      )
    }
    const sum = key => tasks.reduce((n, t) => n + t[key], 0)
    return section(
      para(limit ? `${limit.percent}% of your ${name} limit is used, as reported by Claude.` : `No ${name} reading yet.`),
      para('The tokens and tasks below are from Cowork only. Code tab chats and claude.ai also count towards this limit, but they cannot be seen from here.', 'dim'),
      stack(...tokenSegments({ input: sum('input'), output: sum('output'), cacheWrite: sum('cacheWrite'), cacheRead: sum('cacheRead') }).map(x => row(x.label, fmtTokens(x.tokens), '', x.color))),
      rows.length ? para(`Tasks · ${rows.length} · estimated share of tracked usage`, 'dim') : para('No Cowork tasks in this window.', 'dim'),
      stack(...rows.map(t => press(`task-${t.id}`, chatSvg(W, t, color, at), `${t.title} ${t.share}%`, () => set({ task: t.id })))),
    )
  }

  function agentCard(a, s, at) {
    const look = lookOf(a)
    const end = a.status === 'running' ? at : a.endedAt
    return {
      look, isWalking: a.status === 'running', title: a.description || a.type, tag: a.type, tagColor: TIER[look] ?? '#888780', meta: modelName(a.model),
      left: a.current && a.status === 'running' ? shortLabel(a.current) : plural(a.steps, 'step'),
      stats: `${fmtTokens(a.tokens)}  ≈${fmtCost(costOf(a.model, a))}  ${clockTime(Math.max(0, end - a.startedAt))}`,
      ratio: Math.min(1, a.contextTokens / (s.chatWindow || 200000)), barColor: TIER[look] ?? '#888780', status: a.status,
    }
  }

  function agentList(words, list, s, at, W) {
    if (!list.length) return ''
    return section(para(`${words} · ${list.length}`, 'dim'), stack(...list.map(a => {
      const id = `agent:${a.id}`
      const opened = p.open === id ? stack(a.current ? para(`Now: ${a.current}`, 'dim') : '', ...tokenSegments(a).map(x => row(x.label, fmtTokens(x.tokens), '', x.color))) : ''
      return press(`a-${a.id}`, agentSvg(W, agentCard(a, s, at)), `${a.description}, ${a.status}`, () => set({ open: p.open === id ? '' : id, detail: '', task: '' })) + opened
    })))
  }

  function activity(l, s, at, W) {
    const busy = l.recent.filter(r => !isHousekeeping(r.tool) && !r.isDone).slice(-4).reverse()
    const timeline = (s.scan?.chat?.timeline ?? []).filter(r => r.kind === 'reply' || !isHousekeeping(r.tool)).reverse()
    const parts = [button('live-t', `${p.showActivity ? '▾' : '▸'} What Claude did`, () => { p.showActivity = !p.showActivity; draw() }, 'plain')]
    if (p.showActivity) {
      if (!busy.length && !timeline.length) parts.push(para('Nothing yet. Each reply and job shows up here with the tokens it took.', 'dim'))
      const summary = jobSummary(l.counts)
      if (summary) parts.push(para(summary, 'dim'))
      for (const r of busy) parts.push(`<p><span style="color:#D97757">●</span> ${xml(jobOf(r.tool))}${r.label ? `<span class="dim">: ${xml(r.label.slice(0, 44))}</span>` : ''}</p>`)
      for (const r of timeline.slice(0, p.moreJobs ? 40 : 10)) {
        const name = r.kind === 'reply' ? 'Replied' : `${jobOf(r.tool)}${r.label ? `: ${shortLabel(r.label)}` : ''}`
        const value = `${r.kind === 'job' ? '~' : ''}${fmtTokens(r.tokens)}`
        const isOpen = p.job === r.id
        parts.push(press(`job-${r.id}`, jobSvg(W, r.isError ? BAD : r.kind === 'reply' ? '#D97757' : GOOD, name, value, isOpen), `${name}, ${value} tokens`, () => { p.job = isOpen ? '' : r.id; draw() }))
        if (isOpen) parts.push(section(...explainRow(r).map(t => para(t))))
      }
      if (timeline.length > 10) parts.push(button('more', p.moreJobs ? 'Show fewer' : `Show more (${Math.min(timeline.length, 40)})`, () => { p.moreJobs = !p.moreJobs; draw() }, 'plain'))
      const apps = Object.entries(l.connectors).filter(([k]) => !k.startsWith('ccd_') && !/usage[-_]desk/i.test(k)).map(([k, n]) => `${appName(k)} (${n})`)
      if (l.files.length) parts.push(para(`Files touched: ${l.files.map(f => shortLabel(f)).slice(-8).join(', ')}`, 'dim'))
      if (apps.length) parts.push(para(`Apps used: ${apps.join(', ')}`, 'dim'))
      if (l.skills.length) parts.push(para(`Skills used: ${l.skills.join(', ')}`, 'dim'))
    }
    return section(...parts)
  }

  // ---------- The whole page

  function saved(limit, percent, readAt, at, length) {
    if (limit) return limit
    if (typeof percent !== 'number' || !readAt || at - readAt >= length) return null
    return { percent, resetsAt: '', isLive: false, readAt }
  }

  function view() {
    handlers = []
    const at = Date.now()
    const W = Math.max(220, Math.min(640, root.clientWidth))
    const task = data.task
    const state = task?.state ?? {}
    const prefs = data.prefs ?? {}
    const name = prefs.name || DEFAULT_NAME
    const look = prefs.costume || 'other'
    const base = state.snapshot ?? { chatTokens: 0, chatWindow: 0, chatPercent: 0, model: '', cost: 0, startedAt: 0 }
    const limits = data.limits ?? {}
    const s = {
      ...base,
      five: saved(base.five, limits.fiveHour, limits.readAt, at, FIVE_H),
      week: saved(base.week, limits.weekly, limits.readAt, at, WEEK),
      breakdown: state.breakdown ?? null,
      scan: state.scan ?? null,
      model: state.breakdown?.model || base.model,
    }
    const isFresh = task && at - task.updatedAt < 30000
    // A task that stopped reporting long ago is history, not the task in front of the person.
    const isStale = !!task && at - task.updatedAt > 10 * 60000
    const l = { recent: [], counts: {}, files: [], skills: [], connectors: {}, ...(state.live ?? {}) }
    const isWorking = !!(l.isWorking && isFresh)
    if (!isWorking) l.recent = l.recent.map(r => ({ ...r, isDone: true }))
    const list = state.agents ?? []
    const c = state.cache ?? { lastEnd: 0, ttlMs: FIVE_M, isKnown: false, tokens: 0 }
    const w = state.warm ?? { isOn: false, pings: 0, isSending: false, note: '' }
    // Each request's own figures, where the task measured them, in place of Cowork's sparse log.
    const measured = Object.entries(state.steps ?? {})
    const pick = name => measured.reduce((n, [, row]) => n + (row[name] || 0), 0)
    const logged = s.scan?.chat ? s.scan.chat.input + s.scan.chat.output + s.scan.chat.cacheWrite + s.scan.chat.cacheRead : 0
    // The measured figures start over when the plugin reloads, so the fuller of the two counts wins.
    if (s.scan?.chat && measured.length && pick('input') + pick('output') + pick('cacheWrite') + pick('cacheRead') >= logged) {
      s.scan = { ...s.scan, chat: { ...s.scan.chat, input: pick('input'), output: pick('output'), cacheWrite: pick('cacheWrite'), cacheRead: pick('cacheRead'), replies: pick('requests'), cost: measured.reduce((n, [model, row]) => n + costOf(model, row), 0) } }
    }
    // The window's own address holds its private key, so opening it is never listed.
    if (s.scan?.chat?.largest) s.scan = { ...s.scan, chat: { ...s.scan.chat, largest: s.scan.chat.largest.filter(row => !isHousekeeping(row.tool) && !/127\.0\.0\.1/.test(row.label)) } }
    const sc = s.scan?.chat
    const whole = sc ? sc.input + sc.output + sc.cacheWrite + sc.cacheRead + sc.subagentTokens : 0
    const canAct = !!state.link?.isOpen && !!isFresh
    const R = Math.max(120, W - CRAB_W - 14)
    const toggle = open => {
      const isClosing = p.open === open
      set(isClosing ? { open: '', detail: '', task: '' } : { open, detail: '', task: '' })
      if (!isClosing && open === 'chat') act('exact', true)
    }
    const limitLine = limit => (!limit ? 'no reading yet' : limit.isLive ? resetWords(limit.resetsAt, at) : `saved ${agoWords(at - limit.readAt)}`)
    const chatSegments = s.breakdown ? s.breakdown.categories.filter(x => x.kind === 'used').sort(categoryOrder).map(x => ({ color: categoryColor(x.name), share: s.chatWindow ? (x.tokens / s.chatWindow) * 100 : 0 })) : [{ color: '#D97757', share: s.chatPercent }]
    const lookName = COSTUMES.find(x => x.value === look)?.label ?? 'Owl'
    const bar = (id, title, note, value, segments) => press(`b-${id}`, heroBarSvg(R, { id, title, note, value, isOpen: p.open === id, segments }), `${title} ${value}`, () => toggle(id))

    const parts = [
      `<div class="hero"><div style="flex:none;width:${CRAB_W}px">${press('me', heroCrabSvg(look, isWorking), `Your agent, ${lookName}. Press to change the icon.`, () => { p.showLooks = !p.showLooks; draw() })}</div><div class="right">`,
      press('hero-name', heroHeadSvg(R, name, s.model ? modelName(s.model) : 'Claude', isWorking), `${name}, ${isWorking ? 'working' : 'idle'}. Press to rename.`, () => { p.isRenaming = true; rename(name) }),
      bar('chat', 'Current task', `${fmtTokens(s.chatTokens)}/${fmtTokens(s.chatWindow)}`, `${Math.round(s.chatPercent)}%`, chatSegments),
      bar('five', '5 hours', limitLine(s.five), s.five ? `${s.five.percent}%` : '–', [{ color: FIVE_COLOR, share: s.five?.percent ?? 0 }]),
      bar('week', 'Weekly', limitLine(s.week), s.week ? `${s.week.percent}%` : '–', [{ color: WEEK_COLOR, share: s.week?.percent ?? 0 }]),
      '</div></div>',
      `<div class="section">${tilesSvg(W, [{ k: 'Est. cost', v: `≈${fmtCost(sc ? sc.cost + sc.subagentCost : s.cost)}` }, { k: 'Tokens used', v: fmtTokens(whole) }, { k: isStale ? 'Task length' : 'Task age', v: s.startedAt ? clockTime(Math.max(0, (isStale ? task.updatedAt : at) - s.startedAt)) : '–' }])}</div>`,
    ]
    if (!task && data.wanted) parts.push(section(para('This task has not sent its figures yet. They arrive after its next reply.')))
    if (isStale) parts.push(section(para(`No task is reporting right now. These figures are from a task last active ${agoWords(at - task.updatedAt)}.`)))

    if (p.showLooks) {
      parts.push(section(para(`Agent icon · ${lookName}`, 'dim'), stack(...COSTUMES.map(x => press(`look-${x.value}`, lookSvg(W, x.value, x.label, x.value === look), x.label, () => {
        data.prefs = { ...prefs, costume: x.value }
        T.savePrefs({ costume: x.value })
        p.showLooks = false
        draw()
      })))))
    }

    if (isBigChat(s) && s.chatTokens > 0 && p.detail === '' && p.open !== 'chat') {
      parts.push(section(para(`This task is big: every reply re-reads about ${fmtTokens(s.chatTokens)} tokens.`, 'dim'), button('big', 'See how to reduce it ›', () => { set({ open: 'chat', detail: 'Messages', task: '' }); act('exact', true) }, 'plain')))
    }

    if (p.open === 'chat') parts.push(chatSection(s, W))
    if (p.open === 'five') parts.push(windowSection('5-hour', s.five, FIVE_H, FIVE_COLOR, at, W))
    if (p.open === 'week') parts.push(windowSection('weekly', s.week, WEEK, WEEK_COLOR, at, W))

    const notice = state.notice?.text && at - state.notice.at < 120000 ? state.notice.text : p.sent
    if (notice) parts.push(section(para(notice, 'dim')))

    parts.push(agentList('Running', list.filter(a => a.status === 'running').reverse(), s, at, W))
    parts.push(agentList('Finished', list.filter(a => a.status !== 'running').slice(-5).reverse(), s, at, W))

    const cacheLeft = c.lastEnd ? c.lastEnd + c.ttlMs - at : 0
    const cachePct = c.ttlMs ? Math.max(0, Math.min(100, (cacheLeft / c.ttlMs) * 100)) : 0
    const cacheColor = cachePct > 40 ? GOOD : cachePct > 15 ? '#D9A441' : BAD
    parts.push(section(
      para('Cache', 'dim'),
      usageSvg(W, { id: 'cache', title: !c.lastEnd ? 'Waiting for a reply' : cacheLeft > 0 ? 'Warm' : 'Cold', value: cacheLeft > 0 ? mmss(cacheLeft) : '0:00', meta: c.isKnown ? `${c.ttlMs === ONE_H ? '1 hour' : '5 minute'} cache` : 'cache length not known yet', right: cacheLeft > 0 ? '' : 'next reply re-writes it', isOpen: false, segments: [{ color: cacheColor, share: cachePct }] }).replace('>▸<', '><'),
      canAct ? button('warm', w.isOn ? (w.isSending ? 'Pinging…' : 'Stop keep warm') : 'Keep warm', () => act('warm'), 'plain') : para(isStale ? '' : 'Keep warm and Compact appear once this task is sending live updates.', 'dim'),
      w.isOn ? para(`${plural(w.pings, 'ping')} sent. Each one uses a little of your limit.`, 'dim') : w.note ? para(w.note, 'dim') : '',
    ))

    parts.push(activity(l, s, at, W))
    if (!task) parts.push(section(para('No Cowork task has reported yet. Send a message in a task.', 'dim')))
    return { html: parts.join(''), liveWords: !task ? 'Waiting for a task' : isFresh ? 'Live' : `Last update ${agoWords(at - task.updatedAt)}` }
  }

  function rename(current) {
    root.insertAdjacentHTML('afterbegin', `<form class="inline" id="rename" style="margin-bottom:10px"><input aria-label="Agent name" placeholder="${xml(DEFAULT_NAME)}" value="${current === DEFAULT_NAME ? '' : xml(current)}"><button class="primary">Save</button><button type="button" class="plain" id="cancel">Cancel</button></form>`)
    const form = document.getElementById('rename')
    const input = form.querySelector('input')
    input.focus()
    const close = () => { p.isRenaming = false; lastHtml = ''; draw() }
    document.getElementById('cancel').addEventListener('click', close)
    form.addEventListener('submit', event => {
      event.preventDefault()
      const clean = cleanName(input.value)
      data.prefs = { ...data.prefs, name: clean }
      T.savePrefs({ name: clean })
      close()
    })
  }

  function draw() {
    if (p.isRenaming) return
    if (!data) {
      document.getElementById('live').textContent = problem ? 'Not connected' : 'Connecting'
      root.innerHTML = problem ? `<p class="dim">${xml(problem)}</p>` : ''
      return
    }
    const { html, liveWords } = view()
    if (data.version) document.getElementById('version').textContent = `Usage Desk Cowork ${data.version}`
    document.getElementById('live').textContent = isConnected ? liveWords : problem || T.lostWords
    if (html === lastHtml) return
    const focused = document.activeElement?.dataset?.k
    root.innerHTML = html
    lastHtml = html
    if (focused) root.querySelector(`[data-k="${CSS.escape(focused)}"]`)?.focus()
  }

  // Handlers are numbered per drawing, so a press always runs what is on screen.
  const run = target => {
    const el = target.closest('[data-p]')
    if (el) handlers[Number(el.dataset.p)]?.()
  }
  root.addEventListener('click', event => { if (!event.target.closest('#rename')) run(event.target) })
  root.addEventListener('keydown', event => {
    if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('.press')) {
      event.preventDefault()
      run(event.target)
    }
  })
  window.addEventListener('resize', draw)

  async function poll() {
    let wait = T.everyMs
    if (!document.hidden || !data) {
      try {
        data = await T.read()
        isConnected = true
        problem = ''
      } catch (error) {
        isConnected = false
        problem = T.explain ? T.explain(error) : ''
        if (T.retryMs) wait = T.retryMs(error)
      }
      draw()
    }
    setTimeout(poll, wait)
  }
  poll()
  // Countdowns and ages move every second, whatever the reading pace.
  setInterval(draw, 1000)
})()
