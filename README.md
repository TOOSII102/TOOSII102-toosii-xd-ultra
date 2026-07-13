 Fresh WA Bot

Clean Baileys-based WhatsApp bot with prefix commands (`.command`), built to plug
straight into a session produced by your session generator.

## Setup

```bash
npm install
cp .env.example .env
# paste your SESSION_ID from the pairing site into .env
npm start
```

If `SESSION_ID` is empty, the bot falls back to printing a QR code in the terminal
on first run — scan it with WhatsApp > Linked Devices.

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
