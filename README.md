 Fresh WA Bot

A minimal Baileys-based WhatsApp bot with prefix commands (`.command`).

## Setup

```bash
npm install
npm run check
cp .env.example .env
# Optionally set SESSION_ID in .env; otherwise the bot will prompt for a pairing code.
npm start
```

If `SESSION_ID` is empty, the bot prompts for a phone number and prints a pairing code. Complete the linking flow only for an account you control.

> **Credential safety:** `.env` and the generated `session/` directory contain account credentials. They are ignored by Git and must never be committed. If a credential was committed previously, revoke or rotate it in the associated service before continuing.

## Project layout

```
index.js              # connects to WhatsApp, routes messages to commands
config.js              # prefix, bot name, session settings
lib/sessionLoader.js   # decodes SESSION_ID into ./session/creds.json
lib/commandLoader.js   # auto-loads every file in commands/
commands/ping.js       # example command
session/                # auth state lives here (gitignored)
```

## Adding a command

Drop a new file in `commands/`, e.g. `commands/hello.js`:

```js
module.exports = {
    name: 'hello',
    aliases: ['hi'],
    description: 'Say hello',
    category: 'general',
    execute: async (sock, msg, args, ctx) => {
        await sock.sendMessage(ctx.from, { text: 'Hello! 👋' }, { quoted: msg });
    }
};
```

Restart the bot and `.hello` (or `.hi`) works immediately — no other file needs editing.
