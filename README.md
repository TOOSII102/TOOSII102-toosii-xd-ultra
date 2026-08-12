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
| **Utility** | `.alive`, `.calc`, text tools, encoders, `.password`, `.coinflip`, `.age`, `.countdown`, `.time`, `.shorten`, `.fancy`, `.translate`, and private notes commands | Local commands with validated input and persistent personal notes. API-backed commands fall back safely when the service is unavailable. |
| **AI** | `.ai` and aliases `.ask`, `.gpt`, `.gemini`, `.deepseek` | Identifies as **Toosii AI**, created by **Toosii Tech**. This identity cannot be changed by user prompts; the command uses a bounded text-provider chain and a safe fallback. |
| **Download** | `.ytv`, `.yta`, `.tiktok`, `.ig`, `.media` | Resolves authorized public YouTube, TikTok, and Instagram media links. Returns the original source link when a resolver fails. |
| **Fun** | `.8ball`, `.compliment`, `.truth`, `.dare`, `.wyr`, `.meme`, `.quiz`, `.ship`, and more | Uses local response sets and family-friendly prompts. |
| **Games** | `.dice`, `.rps`, `.riddle`, `.trivia`, `.wordchain` | Lightweight games with chat-scoped state where needed. |
| **Education** | `.dict`, `.fruit`, `.poem` | Uses built-in learning prompts and glossary data. |
| **Spiritual** | `.randverse` | Provides a short reflection. |
| **Search** | `.wiki`, `.country`, `.github`, `.ghrepo`, `.recipe`, `.search` | Retrieves public information when network access is available. The web-search command returns a direct search link as a fallback. |
| **Group** | `.groupinfo`, `.admins`, `.groupstats` | Read-only group information commands. |
| **Owner** | `.mode`, `.repo`, `.update` | Restricted to the linked bot owner. |

## Bot access mode

The linked WhatsApp account is the bot owner. The owner can check or change access with `.mode`, `.mode public`, or `.mode private`.

| Mode | Who can run commands |
|---|---|
| **Public** | Anyone can run commands outside the **Owner** category. Owner-category commands remain restricted to the linked owner. |
| **Private** | Only the linked owner can run any command. |

The selected mode is stored locally in `data/bot-mode.json`, which is ignored by Git and survives a process restart.

## API-backed command fallbacks

The optional `KEITH_API_BASE_URL` setting powers `.search`, `.shorten`, `.fancy`, `.translate`, `.ai`, and the media resolvers. The AI command locally enforces the **Toosii AI / Toosii Tech** identity before any provider request and includes the same non-overridable identity instruction in every provider prompt. These commands use strict HTTPS validation, encoded parameters, response limits, and an eight-second timeout. If the API cannot be reached, `.search` returns a direct Google search URL, `.shorten` returns the original URL, `.fancy` returns the original plain text, `.translate` returns the original text, `.ai` suggests using search, and the media commands return the original source link. No API key is stored by the bot for these commands.

## AI and media anti-spam protection

AI and download commands use separate **persistent per-user** quotas. The rate-limit state is stored in `data/rate-limits.json`, is ignored by Git, and survives a bot restart. A rejected request does not call the external provider or resolver.

| Scope | Default quota | Tuning variables |
|---|---:|---|
| AI | 1 request per 2 seconds | `AI_RATE_LIMIT_MAX`, `AI_RATE_LIMIT_WINDOW_SECONDS` |
| Download | 1 request per 2 seconds | `MEDIA_RATE_LIMIT_MAX`, `MEDIA_RATE_LIMIT_WINDOW_SECONDS` |

Set `RATE_LIMIT_ENABLED=false` only for controlled local testing. Users who exceed a limit receive a clear wait-time response, while other users retain their own independent quotas.

## Project layout

```text
index.js                  # connects to WhatsApp and routes messages to commands
config.js                 # prefix, bot name, and session settings
lib/commandLoader.js      # recursively loads command objects and category folders
lib/rateLimiter.js         # persistent per-user AI and media rate limiting
commands/                 # public and owner command modules
commands/utility/         # utility category commands
commands/ai/              # bounded AI assistant commands
commands/download/        # public-media link resolvers
commands/fun/             # fun category commands
commands/games/           # games category commands
commands/education/       # education category commands
commands/spiritual/       # spiritual category commands
commands/search/          # search category commands
commands/group/           # read-only group category commands
scripts/validate.js       # syntax and setup validation
scripts/command-tests.js  # mock-based command behavior tests
session/                  # generated auth state, ignored by Git
data/                     # local runtime state such as bot mode, ignored by Git
```

## Validation

Run `npm run check` to syntax-check every JavaScript file and confirm credential-safe setup files exist. Run `npm test` to exercise the loaded command catalog, categories, aliases, local command replies, notes persistence, owner access controls, group metadata behavior, and mocked public-information services without connecting to WhatsApp. The test suite also verifies rate-limit persistence, expiry, per-user isolation, and blocked-provider prevention.

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
