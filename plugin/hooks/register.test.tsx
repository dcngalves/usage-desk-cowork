import { expect, test } from 'claude-code/testing'

const USAGE = { context: { tokens: 151000, window: 200000, percent: 75 }, rateLimits: [{ kind: 'five_hour', percentUsed: 12, resetsAt: '2099-01-01T00:00:00Z' }, { kind: 'seven_day', percentUsed: 44, resetsAt: '2099-01-02T00:00:00Z' }], startedAt: 5, cost: { usd: 0.5 } }

function engine(on: any, home: string) {
  const calls: any[] = []
  on('env.get', () => ({ value: home }))
  on('session.id', () => ({ value: 'abc' }))
  on('session.start', (_: unknown, e: { cwd: string }) => ({ cwd: e.cwd }))
  on('session.usage', () => ({ value: USAGE }))
  on('clock.now', () => ({ value: 1000 }))
  on('clock.every', () => ({ value: undefined }))
  on('tool.list', () => ({ value: [{ name: 'Read' }, { name: 'mcp__plugin_x_usage-desk__open_usage_desk' }] }))
  on('process.run', () => ({ value: { stdout: JSON.stringify({ chat: { ttl: '5m' } }), stderr: '', exitCode: 0 } }))
  on('mcp.call', (_: unknown, e: any) => {
    calls.push(e)
    const text = JSON.stringify(e).includes('open_usage_desk') ? 'http://127.0.0.1:47821/?k=abc' : JSON.stringify({ viewing: true, actions: [] })
    return { value: { content: [{ type: 'text', text }] } }
  })
  on('prompt.submit', (_: unknown, e: { text: string }) => ({ text: e.text }))
  return calls
}

const settle = () => new Promise(done => setTimeout(done, 30))

test('when a reply ends, live limits and the task figures go to the program on the computer', async ($, on) => {
  const calls = engine(on, '/root')
  on('turn.complete', () => ({ text: 'done' }))
  await $.session.start({ cwd: '/home/claude', surface: 'desktop', isInteractive: true } as never)
  await $.turn.complete({ reason: 'answer', answer: 'done', text: 'done' } as never)
  await settle()
  const sent = JSON.stringify(calls)
  expect(sent).toContain('report_usage')
  expect(sent).toContain('plugin_x_usage-desk')
  expect(sent).toContain('"percent":44')
  expect(sent).toContain('"chatTokens":151000')
})

test('in Cowork, the command opens the window without reaching Claude', async ($, on) => {
  const calls = engine(on, '/root')
  const out: any = await $.prompt.submit({ text: '/cowork-usage' } as never)
  expect(out.drop).toContain('browser panel')
  expect(JSON.stringify(calls)).toContain('Claude_Browser__preview_start')
  expect(JSON.stringify(calls)).toContain('http://127.0.0.1:47821/?k=abc')
})

test('other messages pass through untouched', async ($, on) => {
  engine(on, '/root')
  const out: any = await $.prompt.submit({ text: 'hi' } as never)
  expect(out.text).toBe('hi')
})

test('a new task asks nothing until its first reply ends', async ($, on) => {
  const calls = engine(on, '/root')
  await $.session.start({ cwd: '/home/claude', surface: 'desktop', isInteractive: true } as never)
  await settle()
  expect(JSON.stringify(calls)).not.toContain('report_usage')
})

test('in a Code tab chat, it stays out of the way', async ($, on) => {
  const calls = engine(on, '/Users/someone')
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true } as never)
  await settle()
  const out: any = await $.prompt.submit({ text: '/usage-desk' } as never)
  expect(out.text).toBe('/usage-desk')
  expect(calls.length).toBe(0)
})
