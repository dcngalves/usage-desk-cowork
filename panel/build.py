#!/usr/bin/env python3
"""Builds panel.html, the Usage Desk panel published as a private Artifact.

The page holds no figures. Inside the Claude desktop app it reads them from the Usage Desk
extension on the same computer, through the app, and draws them with the same code as the
extension's own browser window.
"""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
SERVER = os.path.join(HERE, '..', 'extension', 'server')
read = lambda name: open(os.path.join(SERVER, name)).read()

STYLE = """
/* Layout: one narrow column, sized for a side panel. The palette is the Usage Desk window's own. */
:root { --text: #1f1f1f; --dim: #6b6b68; --mute: #9a9a96; --track: #ecebe8; --line: #e4e4e1; --fill: #f4f3f0; --bg: #faf9f5; --accent: #d97757; --on-accent: #ffffff; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --text: #ececec; --dim: #a8a8a4; --mute: #7d7d79; --track: #2c2c2b; --line: #333331; --fill: #262625; --bg: #1f1e1d; --accent: #d97757; --on-accent: #ffffff; color-scheme: dark } }
:root[data-theme="dark"] { --text: #ececec; --dim: #a8a8a4; --mute: #7d7d79; --track: #2c2c2b; --line: #333331; --fill: #262625; --bg: #1f1e1d; --accent: #d97757; --on-accent: #ffffff; color-scheme: dark }
* { box-sizing: border-box; }
body { background: var(--bg); color: var(--text); font: 13px/1.45 ui-sans-serif, -apple-system, "Segoe UI", sans-serif; overflow-x: hidden; padding-block: 14px 28px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
main { max-width: 640px; margin: 0 auto; }
svg { display: block; max-width: 100%; }
#head { display: flex; justify-content: space-between; color: var(--dim); font-size: 12px; margin-bottom: 10px; gap: 12px; }
.hero { display: flex; gap: 8px; align-items: center; }
.hero .right { flex: 1; min-width: 0; }
.press { cursor: pointer; border-radius: 4px; }
.press:hover { background: color-mix(in srgb, var(--text) 5%, transparent); }
.press:focus-visible, button:focus-visible, input:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.section { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }
.dim { color: var(--dim); }
p { margin: 0; }
p:empty { display: none; }
.row { display: flex; justify-content: space-between; gap: 10px; padding: 2px 0; }
.row .name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.row .value { flex: none; color: var(--dim); font-variant-numeric: tabular-nums; }
.row .note { color: var(--dim); margin-left: 6px; }
.dot { display: inline-block; width: 9px; height: 9px; border-radius: 2px; margin-right: 6px; }
button { font: inherit; color: inherit; background: var(--fill); border: 1px solid var(--line); border-radius: 6px; padding: 4px 10px; cursor: pointer; align-self: flex-start; }
button.primary { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
button.plain { background: none; border: 0; padding: 2px 0; color: var(--dim); text-align: left; }
button.plain:hover { color: var(--text); }
input { font: inherit; color: inherit; background: var(--fill); border: 1px solid var(--line); border-radius: 6px; padding: 5px 8px; flex: 1; min-width: 0; }
.inline { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.stack { display: flex; flex-direction: column; }
"""

TRANSPORT = r"""
// This page reads from the Usage Desk extension on this computer, through the Claude app.
(function () {
  const SERVER = 'host:Usage_Desk'
  const PREFS = 'usage-desk-prefs'
  let mcp = null
  let own = ''
  let hasAsked = false
  const ready = (async () => { mcp = window.claude && window.claude.use ? await window.claude.use('mcp') : null })()
  // What each refusal means for the person, and what fixes it.
  const WORDS = {
    no_app: 'Usage Desk reads from your computer, so it only works inside the Claude desktop app. Open this page there.',
    server_not_connected: 'The Usage Desk extension is not answering. Check that it is installed and turned on in the Claude desktop app, and that this page is open in that app.',
    not_in_manifest: "This page is not allowed to use the Usage Desk extension. Allow it in the page's Permissions menu.",
    approval_required: 'The app wants your approval before this page reads the extension. Allow it when asked.',
    not_granted: 'This view was not given access to the Usage Desk extension.',
    capability_disabled: 'This view cannot reach programs on your computer. Open the page in the Claude desktop app.',
    capability_removed: 'This view cannot reach programs on your computer. Open the page in the Claude desktop app.',
    blocked_by_policy: 'Your organization blocks this page from using the Usage Desk extension.',
    cancelled: 'The app did not allow that, so nothing was sent to the task.',
    bad_answer: 'The extension answered without figures. Update the Usage Desk extension.',
    tool_error: 'The extension could not do that. Update the Usage Desk extension.',
  }
  const DENIED = ['no_app', 'server_not_connected', 'not_in_manifest', 'approval_required', 'not_granted', 'capability_disabled', 'capability_removed', 'blocked_by_policy']
  // The agent's name and outfit are this viewer's own taste, so they stay in this browser.
  const localPrefs = () => {
    try { return JSON.parse(localStorage.getItem(PREFS) || '{}') || {} } catch { return {} }
  }
  window.usageDeskTransport = {
    everyMs: 5000,
    lostWords: 'Not connected to your computer',
    read: async () => {
      await ready
      if (!mcp) throw { code: 'no_app' }
      // Opened beside a task, the link ends in that task's id, and the panel follows that task alone.
      const named = /^#([0-9a-f][0-9a-f-]{7,63})$/i.exec(location.hash || '')
      if (named) own = named[1]
      // Without an id in the link, the first reading asks which task opened this panel, and keeps to it.
      const result = await mcp.callTool(SERVER, 'read_usage', own ? { task: own } : hasAsked ? {} : { isNew: true }, { cache: false })
      hasAsked = true
      if (!own && result && result.payload && result.payload.wanted) own = result.payload.wanted
      const figures = result && result.payload
      if (!figures || typeof figures !== 'object' || !Array.isArray(figures.tasks)) throw { code: 'bad_answer' }
      figures.prefs = { ...(figures.prefs || {}), ...localPrefs() }
      return figures
    },
    explain: error => WORDS[error && error.code] || 'A reading failed. Usage Desk will try again.',
    // After a refusal that repeating cannot fix, it checks back once a minute instead.
    // The extension restarts when the panel first opens, so that one is tried again soon.
    retryMs: error => (error && error.code === 'server_not_connected' ? 5000 : DENIED.includes(error && error.code) ? 60000 : 5000),
    act: async (task, action, isQuiet) => {
      if (isQuiet) return
      await ready
      if (!mcp) throw { code: 'no_app' }
      await mcp.callTool(SERVER, 'usage_action', { task, action }, { cache: false })
    },
    savePrefs: patch => {
      try { localStorage.setItem(PREFS, JSON.stringify({ ...localPrefs(), ...patch })) } catch {}
    },
  }
})()
"""

page = f"""<title>Usage Desk Cowork 0.9.8</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>{STYLE}</style>
<main>
<div id="head"><span id="version">Usage Desk Cowork</span><span id="live">Connecting</span></div>
<div id="root"></div>
</main>
<script>{TRANSPORT}</script>
<script>
{read('window-lib.js')}
</script>
<script>
{read('window-view.js')}
</script>
"""
assert '</script>' not in read('window-lib.js') and '</script>' not in read('window-view.js')
open(os.path.join(HERE, 'panel.html'), 'w').write(page)
print('panel.html', len(page), 'bytes')
