'use strict';

// Local sandbox console for exercising commands without linking a WhatsApp
// account. It loads the real command modules and calls them with a stub socket,
// so replies are produced by the same code paths the bot uses in production.

const http = require('http');
const { loadCommands } = require('../lib/commandLoader');
const { PREFIX, BOT_NAME } = require('../config');

const PORT = Number(process.env.SANDBOX_PORT || 3000);
const HOST = '0.0.0.0';
const TEST_GROUP = '120363000000000000@g.us';
const TEST_DM = '254700000001@s.whatsapp.net';

const commands = loadCommands();
const unique = [...new Set([...commands.values()])];

function buildContext({ chatType, isOwner }) {
    const from = chatType === 'group' ? TEST_GROUP : TEST_DM;
    const sender = isOwner ? `${process.env.OWNER_NUMBER || '254700000000'}@s.whatsapp.net` : TEST_DM;
    return {
        from,
        sender,
        prefix: PREFIX,
        isGroup: chatType === 'group',
        isOwner: Boolean(isOwner),
        pushName: isOwner ? 'Owner' : 'Tester',
        body: ''
    };
}

async function runCommand(line, options) {
    const trimmed = String(line || '').trim();
    if (!trimmed) return { ok: false, output: 'Type a command, for example: .ping' };

    const withoutPrefix = trimmed.startsWith(PREFIX) ? trimmed.slice(PREFIX.length) : trimmed;
    const [rawName, ...args] = withoutPrefix.split(/\s+/);
    const name = (rawName || '').toLowerCase();
    const command = commands.get(name);
    if (!command) return { ok: false, output: `Unknown command "${name}". Try ${PREFIX}menu.` };

    const messages = [];
    const sock = {
        user: { id: '254700000000:1@s.whatsapp.net', name: BOT_NAME },
        sendMessage: async (_jid, content) => {
            if (typeof content?.text === 'string') messages.push(content.text);
            else if (content?.image) messages.push('[image] ' + (content.caption || ''));
            else if (content?.video) messages.push('[video] ' + (content.caption || ''));
            else if (content?.audio) messages.push('[audio]');
            else messages.push('[non-text reply] ' + JSON.stringify(content).slice(0, 300));
            return { key: { id: 'stub' } };
        },
        groupMetadata: async () => ({
            id: TEST_GROUP,
            subject: 'Sandbox Test Group',
            owner: TEST_DM,
            participants: [
                { id: TEST_DM, admin: 'superadmin' },
                { id: '254700000002@s.whatsapp.net', admin: null }
            ]
        }),
        sendPresenceUpdate: async () => {}
    };

    const ctx = buildContext(options);
    const msg = { key: { remoteJid: ctx.from, fromMe: false, participant: ctx.sender }, message: { conversation: trimmed } };

    const startedAt = Date.now();
    try {
        await command.execute(sock, msg, args, ctx);
        return {
            ok: true,
            ms: Date.now() - startedAt,
            output: messages.join('\n\n---\n\n') || '(the command produced no reply)'
        };
    } catch (error) {
        return { ok: false, ms: Date.now() - startedAt, output: `Command threw: ${error.message}\n\n${error.stack || ''}` };
    }
}

function categorised() {
    const groups = new Map();
    for (const command of unique) {
        const key = command.category || 'utility';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(command);
    }
    return [...groups.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([category, list]) => ({
            category,
            commands: list
                .map((c) => ({ name: c.name, description: c.description || '' }))
                .sort((a, b) => a.name.localeCompare(b.name))
        }));
}

function renderPage() {
    const data = categorised();
    const total = unique.length;
    const chips = data.map((group) => `
      <section class="cat">
        <h3>${group.category} <span class="count">${group.commands.length}</span></h3>
        <div class="chips">
          ${group.commands.map((c) => `<button class="chip" data-cmd="${PREFIX}${c.name}" title="${c.description.replace(/"/g, '&quot;')}">${PREFIX}${c.name}</button>`).join('')}
        </div>
      </section>`).join('');

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${BOT_NAME} — sandbox console</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
         background:#0b1016; color:#e6edf3; }
  header { padding:18px 22px; border-bottom:1px solid #1d2733; background:#0e141c; position:sticky; top:0; z-index:5; }
  header h1 { margin:0; font-size:17px; letter-spacing:.2px; }
  header p { margin:6px 0 0; color:#8b98a9; font-size:13px; }
  .wrap { display:grid; grid-template-columns: minmax(0,1fr) 340px; gap:0; min-height: calc(100vh - 74px); }
  @media (max-width: 900px){ .wrap { grid-template-columns: 1fr; } aside { border-left:0 !important; border-top:1px solid #1d2733; } }
  main { padding:20px 22px; min-width:0; }
  .bar { display:flex; gap:10px; flex-wrap:wrap; align-items:center; margin-bottom:14px; }
  input[type=text] { flex:1 1 320px; min-width:0; padding:12px 14px; border-radius:10px; border:1px solid #263243;
                     background:#111925; color:#e6edf3; font-size:15px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  input[type=text]:focus { outline:2px solid #2f81f7; outline-offset:0; border-color:transparent; }
  button.run { padding:12px 20px; border-radius:10px; border:0; background:#2f81f7; color:#fff; font-weight:600; cursor:pointer; font-size:15px; }
  button.run:disabled { opacity:.55; cursor:progress; }
  label.tog { display:inline-flex; gap:7px; align-items:center; font-size:13px; color:#9fb0c3; cursor:pointer;
              background:#111925; border:1px solid #263243; padding:9px 12px; border-radius:10px; }
  .log { display:flex; flex-direction:column; gap:12px; }
  .entry { border:1px solid #223044; border-radius:12px; overflow:hidden; background:#0f1620; }
  .entry .cmd { padding:9px 14px; background:#131d2a; font-family:ui-monospace,Menlo,monospace; font-size:13px;
                display:flex; justify-content:space-between; gap:12px; align-items:center; }
  .entry .cmd b { color:#7ee787; font-weight:600; }
  .entry .cmd .meta { color:#7d8da0; font-size:12px; white-space:nowrap; }
  .entry pre { margin:0; padding:14px; white-space:pre-wrap; word-wrap:break-word; overflow-wrap:anywhere;
               font-family:ui-monospace,Menlo,monospace; font-size:13.5px; line-height:1.55; }
  .entry.bad { border-color:#5c2b30; } .entry.bad pre { color:#ffb4ab; }
  aside { border-left:1px solid #1d2733; padding:18px; background:#0c1219; max-height:calc(100vh - 74px); overflow:auto; }
  aside h2 { margin:0 0 4px; font-size:14px; }
  aside .hint { color:#8b98a9; font-size:12.5px; margin:0 0 14px; }
  .cat h3 { margin:16px 0 8px; font-size:12px; text-transform:uppercase; letter-spacing:.09em; color:#8b98a9; }
  .cat .count { color:#5d6b7d; font-weight:400; }
  .chips { display:flex; flex-wrap:wrap; gap:6px; }
  .chip { background:#152030; border:1px solid #24344a; color:#c6d4e3; border-radius:999px; padding:5px 11px;
          font-size:12.5px; cursor:pointer; font-family:ui-monospace,Menlo,monospace; }
  .chip:hover { background:#1d2d42; border-color:#2f81f7; color:#fff; }
  .empty { color:#6b7a8d; font-size:14px; padding:26px; text-align:center; border:1px dashed #223044; border-radius:12px; }
</style>
</head>
<body>
<header>
  <h1>${BOT_NAME} — sandbox console</h1>
  <p>Runs the real command modules with a stub WhatsApp socket. ${total} commands loaded. No account is linked.</p>
</header>
<div class="wrap">
  <main>
    <div class="bar">
      <input type="text" id="cmd" placeholder="${PREFIX}ping" autocomplete="off" spellcheck="false">
      <button class="run" id="run">Run</button>
      <label class="tog"><input type="checkbox" id="owner" checked> owner</label>
      <label class="tog"><input type="checkbox" id="group"> group chat</label>
    </div>
    <div class="log" id="log">
      <div class="empty">Run a command to see the bot's reply. Click any command on the right to load it.</div>
    </div>
  </main>
  <aside>
    <h2>Commands</h2>
    <p class="hint">Click to insert. Some need an argument, e.g. <code>${PREFIX}exchange KES</code>.</p>
    ${chips}
  </aside>
</div>
<script>
  const logEl = document.getElementById('log');
  const cmdEl = document.getElementById('cmd');
  const runEl = document.getElementById('run');
  let first = true;

  function esc(s){ return String(s).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }

  async function run() {
    const line = cmdEl.value.trim();
    if (!line) return;
    runEl.disabled = true;
    if (first) { logEl.innerHTML = ''; first = false; }
    try {
      const res = await fetch('/run', {
        method:'POST', headers:{'content-type':'application/json'},
        body: JSON.stringify({
          line,
          isOwner: document.getElementById('owner').checked,
          chatType: document.getElementById('group').checked ? 'group' : 'dm'
        })
      });
      const data = await res.json();
      const el = document.createElement('div');
      el.className = 'entry' + (data.ok ? '' : ' bad');
      el.innerHTML = '<div class="cmd"><b>' + esc(line) + '</b><span class="meta">' +
                     (data.ms != null ? data.ms + ' ms' : '') + '</span></div><pre>' + esc(data.output) + '</pre>';
      logEl.prepend(el);
    } catch (err) {
      const el = document.createElement('div');
      el.className = 'entry bad';
      el.innerHTML = '<div class="cmd"><b>' + esc(line) + '</b></div><pre>' + esc(err.message) + '</pre>';
      logEl.prepend(el);
    } finally {
      runEl.disabled = false;
      cmdEl.focus();
      cmdEl.select();
    }
  }

  runEl.addEventListener('click', run);
  cmdEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
  document.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', () => { cmdEl.value = chip.dataset.cmd + ' '; cmdEl.focus(); });
  });
  cmdEl.focus();
</script>
</body>
</html>`;
}

const server = http.createServer(async (req, res) => {
    if (req.method === 'GET' && (req.url === '/' || req.url.startsWith('/?'))) {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        return res.end(renderPage());
    }

    if (req.method === 'POST' && req.url === '/run') {
        let body = '';
        req.on('data', (chunk) => {
            body += chunk;
            if (body.length > 10000) req.destroy();
        });
        return req.on('end', async () => {
            let payload = {};
            try { payload = JSON.parse(body || '{}'); } catch { /* handled below */ }
            const result = await runCommand(payload.line, {
                isOwner: payload.isOwner !== false,
                chatType: payload.chatType === 'group' ? 'group' : 'dm'
            });
            res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify(result));
        });
    }

    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('Not found');
});

server.listen(PORT, HOST, () => {
    console.log(`[Sandbox] Console listening on http://${HOST}:${PORT} with ${unique.length} commands.`);
});
