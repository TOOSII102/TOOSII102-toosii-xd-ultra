# Fresh WA Bot

A minimal Baileys-based WhatsApp bot with prefix commands. Commands are loaded recursively from the `commands/` directory and are displayed by category through `.menu`.

## Setup

```bash
npm install
npm run check
npm test
cp .env.example .env
# Optionally set SESSION_ID in .env; otherwise the bot prompts for a pairing code.
npm start
```

If `SESSION_ID` is empty, the bot prompts for a phone number and prints a pairing code. Complete the linking flow only for an account you control.

> **Credential safety:** `.env` and the generated `session/` directory contain account credentials. They are ignored by Git and must never be committed. If a credential was committed previously, revoke or rotate it in the associated service before continuing.

## Command categories

The command categories mirror the compatible portions of the supplied command archive. `.menu` shows only public categories to normal users and adds the **Owner** category for the linked bot owner.

| Category | Commands | Notes |
|---|---|---|
| **Utility** | `.ping`, `.menu`, `.owner`, `.calc`, `.uptime`, `.ebinary`, `.debinary`, `.ebase`, `.dbase`, `.ehex`, `.dhex` | Local commands with input validation. |
| **Fun** | `.8ball`, `.compliment` | Uses local response sets. |
| **Games** | `.dice`, `.rps` | Lightweight games that do not require persistent game state. |
| **Education** | `.dict`, `.fruit`, `.poem` | Uses built-in learning prompts and glossary data. |
| **Spiritual** | `.randverse` | Provides a short reflection. |
| **Search** | `.wiki` | Retrieves a concise Wikipedia summary when network access is available. |
| **Owner** | `.mode`, `.update` | Restricted to the linked bot owner. |

## Bot access mode

The linked WhatsApp account is the bot owner. The owner can check or change access with `.mode`, `.mode public`, or `.mode private`.

| Mode | Who can run commands |
|---|---|
| **Public** | Anyone can run commands outside the **Owner** category. Owner-category commands remain restricted to the linked owner. |
| **Private** | Only the linked owner can run any command. |

The selected mode is stored locally in `data/bot-mode.json`, which is ignored by Git and survives a process restart.

## Project layout

```text
index.js                  # connects to WhatsApp and routes messages to commands
config.js                 # prefix, bot name, and session settings
lib/commandLoader.js      # recursively loads command objects and category folders
commands/                 # public and owner command modules
commands/utility/         # utility category commands
commands/fun/             # fun category commands
commands/games/           # games category commands
commands/education/       # education category commands
commands/spiritual/       # spiritual category commands
commands/search/          # search category commands
scripts/validate.js       # syntax and setup validation
scripts/command-tests.js  # mock-based command behavior tests
session/                  # generated auth state, ignored by Git
data/                     # local runtime state such as bot mode, ignored by Git
```

## Validation

Run `npm run check` to syntax-check every JavaScript file and confirm credential-safe setup files exist. Run `npm test` to exercise the loaded command catalog, categories, aliases, command replies, owner access guard, and mocked Wikipedia response without connecting to WhatsApp.

## Adding a command

Place a JavaScript module anywhere below `commands/`. The loader accepts either one command object or an array of command objects.

```js
module.exports = {
    name: 'hello',
    aliases: ['hi'],
    description: 'Send a greeting.',
    category: 'fun',
    execute: async (sock, msg, args, ctx) => {
        await sock.sendMessage(ctx.from, { text: 'Hello.' }, { quoted: msg });
    }
};
```

Every command must provide a unique `name` and an asynchronous `execute(sock, msg, args, ctx)` function. The context includes `from`, `sender`, `isGroup`, `prefix`, and the loaded command catalog.
