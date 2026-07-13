const fs = require('fs');
const path = require('path');

const COMMANDS_DIR = path.join(__dirname, '..', 'commands');

/**
 * Each command file must export:
 * {
 *   name: 'ping',            // what follows the prefix, e.g. .ping
 *   aliases: ['p'],          // optional
 *   description: 'Check bot is alive',
 *   category: 'general',
 *   execute: async (sock, msg, args, ctx) => { ... }
 * }
 */
function loadCommands() {
    const commands = new Map();

    if (!fs.existsSync(COMMANDS_DIR)) {
        fs.mkdirSync(COMMANDS_DIR, { recursive: true });
        return commands;
    }

    for (const file of fs.readdirSync(COMMANDS_DIR)) {
        if (!file.endsWith('.js')) continue;

        const fullPath = path.join(COMMANDS_DIR, file);
        try {
            delete require.cache[require.resolve(fullPath)];
            const cmd = require(fullPath);

            if (!cmd?.name || typeof cmd.execute !== 'function') {
                console.warn(`[Commands] Skipping "${file}" — missing name or execute()`);
                continue;
            }

            commands.set(cmd.name.toLowerCase(), cmd);
            (cmd.aliases || []).forEach(alias => commands.set(alias.toLowerCase(), cmd));

            console.log(`[Commands] Loaded: ${cmd.name}`);
        } catch (err) {
            console.error(`[Commands] Failed to load "${file}":`, err.message);
        }
    }

    return commands;
}

module.exports = { loadCommands, COMMANDS_DIR };
