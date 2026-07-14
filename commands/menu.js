'use strict';

const { BOT_NAME, PREFIX } = require('../config');
const { loadCommands } = require('../lib/commandLoader');

function formatUptime(seconds) {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const parts = [];
    if (d) parts.push(`${d}d`);
    if (h) parts.push(`${h}h`);
    if (m) parts.push(`${m}m`);
    parts.push(`${s}s`);
    return parts.join(' ');
}

module.exports = {
    name: 'menu',
    aliases: ['help', 'commands', 'list'],
    description: 'Show all available commands',
    category: 'utility',

    execute: async (sock, msg, args, ctx) => {
        // Re-scan commands so newly added files show up without a restart lookup mismatch.
        const commands = loadCommands();

        // Dedupe: the map has one entry per alias pointing at the same command object.
        const unique = new Map();
        for (const cmd of commands.values()) {
            if (!unique.has(cmd.name)) unique.set(cmd.name, cmd);
        }

        // Group by category.
        const byCategory = {};
        for (const cmd of unique.values()) {
            const cat = (cmd.category || 'general').toUpperCase();
            if (!byCategory[cat]) byCategory[cat] = [];
            byCategory[cat].push(cmd);
        }

        const lines = [];
        lines.push(`╔═|〔  ${BOT_NAME} 〕`);
        lines.push(`║`);
        lines.push(`║ ▸ *Prefix*  : ${PREFIX}`);
        lines.push(`║ ▸ *Commands*: ${unique.size}`);
        lines.push(`║ ▸ *Uptime*  : ${formatUptime(process.uptime())}`);
        lines.push(`║`);

        for (const [category, cmds] of Object.entries(byCategory).sort(([a], [b]) => a.localeCompare(b))) {
            lines.push(`║ ─「 ${category} 」─`);
            for (const cmd of cmds.sort((a, b) => a.name.localeCompare(b.name))) {
                const aliasText = cmd.aliases?.length ? ` (${cmd.aliases.join(', ')})` : '';
                lines.push(`║ ▸ ${PREFIX}${cmd.name}${aliasText}`);
                if (cmd.description) lines.push(`║   ${cmd.description}`);
            }
            lines.push(`║`);
        }

        lines.push(`╚═|〔 Send ${PREFIX}<command> to run one 〕`);

        await sock.sendMessage(ctx.from, { text: lines.join('\n') }, { quoted: msg });
    }
};
