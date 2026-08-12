'use strict';

const { BOT_NAME, PREFIX } = require('../config');
const { isOwner } = require('../middleware/ownerOnly');

const CATEGORY_ORDER = ['utility', 'ai', 'download', 'fun', 'games', 'education', 'spiritual', 'search', 'group', 'owner'];

function titleCase(value) {
    return value.replace(/\b\w/g, (character) => character.toUpperCase());
}

function groupCommands(commands, includeOwner) {
    const groups = new Map();
    for (const command of commands || []) {
        if (!includeOwner && command.category === 'owner') continue;
        const category = command.category || 'utility';
        if (!groups.has(category)) groups.set(category, []);
        groups.get(category).push(command);
    }
    return [...groups.entries()]
        .sort(([left], [right]) => {
            const leftIndex = CATEGORY_ORDER.indexOf(left);
            const rightIndex = CATEGORY_ORDER.indexOf(right);
            return (leftIndex < 0 ? CATEGORY_ORDER.length : leftIndex) - (rightIndex < 0 ? CATEGORY_ORDER.length : rightIndex) || left.localeCompare(right);
        })
        .map(([category, commandsInCategory]) => [category, commandsInCategory.sort((left, right) => left.name.localeCompare(right.name))]);
}

module.exports = {
    name: 'menu',
    aliases: ['help', 'commands', 'cmds'],
    description: 'Show available commands grouped by category.',
    category: 'utility',
    execute: async (sock, msg, args, ctx) => {
        const owner = isOwner(ctx.sender || ctx.from);
        const groups = groupCommands(ctx.commands, owner);
        const lines = [
            `╔═|〔  ${BOT_NAME} MENU  〕`,
            '║',
            `║ ▸ Access: ${owner ? 'Owner' : 'Public'}`
        ];

        for (const [category, commands] of groups) {
            lines.push('║');
            lines.push(`║ [${titleCase(category)}]`);
            for (const command of commands) {
                lines.push(`║ ▸ ${PREFIX}${command.name}`);
            }
        }

        lines.push('║');
        lines.push(`╚═|〔 ${BOT_NAME} 〕`);
        await sock.sendMessage(ctx.from, { text: lines.join('\n') }, { quoted: msg });
    },
    groupCommands
};
