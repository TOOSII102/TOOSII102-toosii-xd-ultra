# Deploying TOOSII-XD-ULTRA

The bot holds a long-lived WhatsApp socket, so it needs a host that keeps a
process running and keeps `session/` on disk between restarts.

Two things decide whether a deployment behaves:

1. **`session/` must persist.** It holds the Signal keys for the linked device.
   On an ephemeral filesystem the device is logged out on every deploy and you
   have to link again.
2. **A supervisor must restart the process.** Then `.restart` can exit knowing
   something will bring it back. Without one it refuses to exit, because that
   would take the bot offline for good.

---

## Option 1 — Docker Compose (recommended)

```bash
cp .env.example .env      # set OWNER_NUMBER, and SESSION_ID if you have one
docker compose up -d --build
docker compose logs -f
```

Handles both requirements: `restart: unless-stopped`, plus named volumes for
`session/` and `data/`. `git` is installed in the image and `.git` is kept in
the build context, so `.update` works inside the container.

## Option 2 — pm2 on a VPS

```bash
npm ci
pm2 start ecosystem.config.js
pm2 save && pm2 startup    # survive a reboot
pm2 logs toosii-xd-ultra
```

Runs in fork mode on purpose. A WhatsApp session cannot be shared across
workers: a second connection on the same credentials triggers a 401 conflict
and knocks the first one off.

## Option 3 — Render

Deploy with `render.yaml` as a **worker** (no HTTP port needed). Set
`OWNER_NUMBER` and `SESSION_ID` in the dashboard. The blueprint attaches a 1GB
disk at `session/` — without it every deploy logs the bot out.

## Option 4 — plain systemd

```ini
[Unit]
Description=TOOSII-XD-ULTRA
After=network-online.target

[Service]
WorkingDirectory=/opt/toosii-xd-ultra
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=RESTART_SUPERVISED=true
EnvironmentFile=/opt/toosii-xd-ultra/.env

[Install]
WantedBy=multi-user.target
```

---

## First run

With `SESSION_ID` set, the bot connects straight away. Leave it empty and it
prints a pairing code to link a device interactively — that needs an attached
terminal, so on a container host prefer generating the session first.

## Keeping it updated

```
.update     pull the latest code from GitHub (owner only)
.restart    restart to load it (owner only)
```

`.update` refuses to run on a dirty tree or when the branch has diverged, so
local edits are never silently discarded. If it reports that `package.json`
changed, run `npm ci` before restarting.

## Health checks

```bash
npm run check   # validates every source file and the credential-safe setup
npm test        # 15 suites
```

## Notes

- Never commit `session/` or `.env`. Both are gitignored, and `.dockerignore`
  keeps them out of the image.
- `WA_LOG_LEVEL=debug` prints Baileys protocol traffic. It is the only reliable
  way to tell a dead connection from a quiet one; leave it `silent` normally.
- `DEBUG_LOGS=true` logs command dispatch without logging message contents.
