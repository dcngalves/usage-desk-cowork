#!/usr/bin/env python3
"""The part of Usage Desk that runs on the person's computer.

It keeps the latest token counts of each Cowork task and shows them in a browser window. The
window is served to this computer only (127.0.0.1) behind a private key, and nothing is sent
anywhere else. It uses only Python's standard library, so there is nothing to install.
"""
import fcntl
import http.server
import json
import os
import re
import secrets
import subprocess
import sys
import threading
import time
import urllib.parse
import webbrowser

VERSION = '0.9.4'
PORT = 47821
MAX_TASKS = 30
VIEWING_MS = 12000
ACTIONS = ('warm', 'compact', 'handoff', 'exact')
SERVED = {'/window-lib.js': 'text/javascript', '/window-view.js': 'text/javascript'}
HERE = os.path.dirname(os.path.abspath(__file__))
FOLDER = os.path.expanduser('~/.claude/usage-desk-cowork')
STATE = os.path.join(FOLDER, 'state.json')
HISTORY = os.path.expanduser('~/Library/Application Support/Claude/plan-usage-history.json')

LOCK = os.path.join(FOLDER, 'state.lock')
TASKS = os.path.join(FOLDER, 'tasks')
ACTION_DIR = os.path.join(FOLDER, 'actions')
VIEWING = os.path.join(FOLDER, 'viewing')
key = {'value': None}
address = {'port': None}
received = {'count': 0}

TOOLS = [
    {
        'name': 'open_usage_desk',
        'description': "Opens the live token usage window. With in_app true it opens nothing and returns the window's address.",
        'inputSchema': {'type': 'object', 'properties': {'in_app': {'type': 'boolean'}}},
        'annotations': {'readOnlyHint': True},
        '_meta': {'anthropic/alwaysLoad': True},
    },
    {
        'name': 'report_usage',
        'description': "Sends this task's token figures to the Usage Desk panel on this computer. The Usage Desk plugin calls it by itself. Call it by hand only when the cowork-usage skill says to.",
        'inputSchema': {'type': 'object', 'properties': {
            'session': {'type': 'string'}, 'state': {'type': 'object'}, 'sentAt': {'type': 'integer'}, 'isCheck': {'type': 'boolean'},
            'panel': {'type': 'string', 'description': 'The link of a Usage Desk panel that was just published, to remember it.'},
        }},
        'annotations': {'readOnlyHint': True},
        '_meta': {'anthropic/alwaysLoad': True},
    },
    {
        'name': 'read_usage',
        'description': 'Used by the Usage Desk panel itself to read the latest figures. Do not call this.',
        'inputSchema': {'type': 'object', 'properties': {'task': {'type': 'string', 'description': 'Show this task instead of the most recent one.'}}},
        'annotations': {'readOnlyHint': True},
    },
    {
        'name': 'usage_action',
        'description': 'Used by the Usage Desk panel itself when the person presses Keep warm, Compact or Draft a handoff. Do not call this.',
        'inputSchema': {'type': 'object', 'properties': {
            'task': {'type': 'string'}, 'action': {'type': 'string', 'enum': list(ACTIONS)},
        }, 'required': ['task', 'action']},
        'annotations': {'readOnlyHint': False, 'destructiveHint': False},
    },
]


def read_state():
    try:
        with open(STATE) as f:
            saved = json.load(f)
        return saved if isinstance(saved, dict) else {}
    except (OSError, ValueError):
        return {}


def change_state(change):
    """Each Claude session starts its own copy of this program, so they all share one file."""
    os.makedirs(FOLDER, mode=0o700, exist_ok=True)
    with open(LOCK, 'w') as guard:
        fcntl.flock(guard, fcntl.LOCK_EX)
        saved = read_state()
        change(saved)
        temp = f'{STATE}.{os.getpid()}.tmp'
        descriptor = os.open(temp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(descriptor, 'w') as f:
            json.dump(saved, f)
        os.replace(temp, STATE)
        return saved


def load():
    def ensure_key(saved):
        saved['key'] = saved.get('key') or secrets.token_urlsafe(24)
        saved.pop('tasks', None)
        saved.setdefault('prefs', {})
    key['value'] = change_state(ensure_key)['key']
    os.makedirs(TASKS, mode=0o700, exist_ok=True)
    os.makedirs(ACTION_DIR, mode=0o700, exist_ok=True)


def clean_id(value):
    return re.sub(r'[^A-Za-z0-9-]', '', str(value or ''))[:80]


def read_json(path, fallback):
    try:
        with open(path) as f:
            return json.load(f)
    except (OSError, ValueError):
        return fallback


def write_json(path, value):
    temp = f'{path}.{os.getpid()}.tmp'
    descriptor = os.open(temp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(descriptor, 'w') as f:
        json.dump(value, f)
    os.replace(temp, path)


def task_paths():
    paths = [os.path.join(TASKS, name) for name in os.listdir(TASKS) if name.endswith('.json')]
    return sorted(paths, key=os.path.getmtime, reverse=True)


def report(args):
    """Replaces a task's figures with the latest ones, so nothing piles up."""
    session = clean_id(args.get('session'))
    if 'state' not in args:
        return greet(session, args.get('panel'))
    if not session:
        raise ValueError('no session')
    if args.get('isCheck'):
        # An idle task asking whether a panel is open. Its figures and its last-active time stay as they were.
        return {'viewing': is_viewing(), 'actions': take_actions(session)}
    fresh = args.get('state')
    now = int(time.time() * 1000)
    path = os.path.join(TASKS, session + '.json')
    task = read_json(path, None) or {'id': session, 'startedAt': now, 'state': {}}
    if isinstance(fresh, dict):
        task['state'].update(fresh)
    task['updatedAt'] = now
    write_json(path, task)
    for old in task_paths()[MAX_TASKS:]:
        os.remove(old)
    received['count'] += 1
    return {'viewing': is_viewing(), 'actions': take_actions(session)}


def greet(session, panel):
    """Claude's own call from the cowork-usage skill: which task this is, and where its panel lives."""
    state = read_state()
    panels = state.get('panels') if isinstance(state.get('panels'), dict) else {}
    if isinstance(panel, str) and re.fullmatch(r'https://claude\.ai/[A-Za-z0-9/_-]{1,200}', panel):
        panels = {VERSION: panel}
        change_state(lambda saved: saved.update(panels=panels))
    if not session:
        # Without the plugin's help, the task that reported in the last minute is the one asking.
        paths = task_paths()
        if paths and time.time() - os.path.getmtime(paths[0]) < 60:
            session = os.path.basename(paths[0])[:-5]
    return {'task': session or None, 'panel': panels.get(VERSION), 'title': f'Usage Desk Cowork {VERSION}'}


def is_viewing():
    try:
        return time.time() * 1000 - os.path.getmtime(VIEWING) * 1000 < VIEWING_MS
    except OSError:
        return False


def take_actions(session):
    path = os.path.join(ACTION_DIR, session + '.json')
    actions = []

    def claim(_):
        nonlocal actions
        actions = read_json(path, [])
        if os.path.exists(path):
            os.remove(path)

    if os.path.exists(path):
        change_state(claim)
    return actions


def add_action(session, action):
    path = os.path.join(ACTION_DIR, clean_id(session) + '.json')
    change_state(lambda _: write_json(path, (read_json(path, []) + [action])[-5:]))


summaries = {}


def summary_of(path):
    """A task's totals, read again only when its file has changed."""
    stamp = os.path.getmtime(path)
    known = summaries.get(path)
    if known and known[0] == stamp:
        return known[1]
    task = read_json(path, {})
    state = task.get('state') or {}
    chat = (state.get('scan') or {}).get('chat') or {}
    measured = list((state.get('steps') or {}).values())
    # The measured figures start over when the plugin reloads, so the fuller of the two counts wins.
    names = ('input', 'output', 'cacheWrite', 'cacheRead')
    is_measured = bool(measured) and sum(row.get(n) or 0 for row in measured for n in names) >= sum(chat.get(n) or 0 for n in names)
    pick = lambda name: sum(row.get(name) or 0 for row in measured) if is_measured else chat.get(name) or 0
    value = {
        'id': task.get('id'), 'title': str(chat.get('title') or '')[:80], 'startedAt': task.get('startedAt'), 'updatedAt': task.get('updatedAt'),
        'input': pick('input'), 'output': pick('output'), 'cacheWrite': pick('cacheWrite'), 'cacheRead': pick('cacheRead'),
        'subagentTokens': chat.get('subagentTokens') or 0, 'chatCost': (chat.get('cost') or 0) + (chat.get('subagentCost') or 0),
        'steps': state.get('steps') or {}, 'isMeasured': is_measured,
        'replies': (sum(row.get('requests') or 0 for row in measured) if is_measured else 0) or chat.get('replies') or 0,
    }
    value['tokens'] = value['input'] + value['output'] + value['cacheWrite'] + value['cacheRead'] + value['subagentTokens']
    summaries[path] = (stamp, value)
    return value


def page_data(task=None):
    with open(VIEWING, 'w'):
        pass
    paths = task_paths()
    # A panel opened beside one task shows that task only, even before its first figures arrive.
    wanted = clean_id(task)
    shown = os.path.join(TASKS, f'{wanted}.json') if wanted else (paths[0] if paths else None)
    return {
        'task': read_json(shown, None) if shown and shown in paths else None,
        'wanted': wanted or None,
        'version': VERSION,
        'tasks': [summary_of(p) for p in paths],
        'limits': limits(),
        'prefs': read_state().get('prefs') or {},
        'now': int(time.time() * 1000),
    }


def limits():
    """The app's own last saved reading of the 5-hour and weekly limits."""
    try:
        with open(HISTORY) as f:
            sample = json.load(f)['samples'][-1]
        return {'fiveHour': sample['u'].get('fh'), 'weekly': sample['u'].get('sd'), 'readAt': sample.get('t')}
    except (OSError, ValueError, KeyError, IndexError, AttributeError):
        return None


class Window(http.server.BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def reply(self, status, kind, body):
        self.send_response(status)
        self.send_header('Content-Type', kind)
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.end_headers()
        self.wfile.write(body)

    def allowed(self, url):
        given = urllib.parse.parse_qs(url.query).get('k', [''])[0]
        host = (self.headers.get('Host') or '').split(':')[0]
        return host == '127.0.0.1' and secrets.compare_digest(given, key['value'])

    def do_GET(self):
        url = urllib.parse.urlsplit(self.path)
        if url.path in SERVED:
            with open(os.path.join(HERE, url.path[1:]), 'rb') as f:
                return self.reply(200, SERVED[url.path], f.read())
        if not self.allowed(url):
            return self.reply(403, 'text/plain', b'Not allowed')
        if url.path == '/':
            with open(os.path.join(HERE, 'window.html'), 'rb') as f:
                return self.reply(200, 'text/html; charset=utf-8', f.read())
        if url.path == '/data':
            return self.reply(200, 'application/json', json.dumps(page_data()).encode())
        self.reply(404, 'text/plain', b'Not found')

    def do_POST(self):
        url = urllib.parse.urlsplit(self.path)
        if not self.allowed(url) or self.headers.get('Content-Type') != 'application/json':
            return self.reply(403, 'text/plain', b'Not allowed')
        length = min(int(self.headers.get('Content-Length') or 0), 4096)
        try:
            body = json.loads(self.rfile.read(length))
        except ValueError:
            return self.reply(400, 'text/plain', b'Bad request')
        if url.path == '/action' and body.get('action') in ACTIONS:
            add_action(body.get('task'), body['action'])
        elif url.path == '/prefs':
            def save_prefs(saved):
                prefs = saved.setdefault('prefs', {})
                if isinstance(body.get('name'), str):
                    prefs['name'] = body['name'][:28]
                if isinstance(body.get('costume'), str):
                    prefs['costume'] = body['costume'][:20]
            change_state(save_prefs)
        else:
            return self.reply(404, 'text/plain', b'Not found')
        self.reply(200, 'application/json', b'{}')


def serve():
    for port in (PORT, 0):
        try:
            http_server = http.server.ThreadingHTTPServer(('127.0.0.1', port), Window)
        except OSError:
            continue
        http_server.daemon_threads = True
        address['port'] = http_server.server_address[1]
        threading.Thread(target=http_server.serve_forever, daemon=True).start()
        return


def window_url():
    return f"http://127.0.0.1:{address['port']}/?k={key['value']}" if address['port'] else None


def open_window():
    url = window_url()
    if not url:
        return False
    if os.environ.get('USAGE_DESK_NO_BROWSER'):
        return True
    if sys.platform == 'darwin':
        return subprocess.run(['open', url], capture_output=True).returncode == 0
    return webbrowser.open(url)


def handle(method, params):
    if method == 'initialize':
        return {
            'protocolVersion': params.get('protocolVersion') or '2025-06-18',
            'capabilities': {'tools': {}},
            'serverInfo': {'name': 'usage-desk', 'version': VERSION},
        }
    if method == 'ping':
        return {}
    if method == 'tools/list':
        return {'tools': TOOLS}
    if method == 'tools/call':
        name = params.get('name')
        if name == 'open_usage_desk':
            if (params.get('arguments') or {}).get('in_app'):
                url = window_url()
                return {'content': [{'type': 'text', 'text': url or 'The window is not running.'}], 'isError': not url}
            opened = open_window()
            text = '\n'.join([
                f'Usage Desk {VERSION}',
                'Window: ' + ('opened' if opened else 'could not open'),
                f"Counts received since start: {received['count']}",
                f"Tasks known: {len(task_paths())}",
            ])
            return {'content': [{'type': 'text', 'text': text}], 'isError': not opened}
        if name == 'usage_action':
            args = params.get('arguments') or {}
            if args.get('action') not in ACTIONS or not clean_id(args.get('task')):
                return {'content': [{'type': 'text', 'text': 'Unknown action'}], 'isError': True}
            add_action(args['task'], args['action'])
            return {'content': [{'type': 'text', 'text': json.dumps({'queued': args['action']})}]}
        if name == 'read_usage':
            return {'content': [{'type': 'text', 'text': json.dumps(page_data((params.get('arguments') or {}).get('task')))}]}
        if name == 'report_usage':
            return {'content': [{'type': 'text', 'text': json.dumps(report(params.get('arguments') or {}))}]}
        return {'content': [{'type': 'text', 'text': 'Unknown tool'}], 'isError': True}
    raise LookupError(method)


def main():
    load()
    serve()
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            request = json.loads(line)
        except ValueError:
            continue
        if not isinstance(request, dict) or 'id' not in request or 'method' not in request:
            continue
        reply = {'jsonrpc': '2.0', 'id': request['id']}
        try:
            reply['result'] = handle(request['method'], request.get('params') or {})
        except LookupError:
            reply['error'] = {'code': -32601, 'message': 'Not found'}
        except Exception as error:
            reply['error'] = {'code': -32603, 'message': type(error).__name__}
        sys.stdout.write(json.dumps(reply) + '\n')
        sys.stdout.flush()


if __name__ == '__main__':
    main()
