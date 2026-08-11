'use strict';

function formatDuration(totalSeconds) {
    const seconds = Math.floor(totalSeconds);
    const units = [
        ['day', 86400],
        ['hour', 3600],
        ['minute', 60],
        ['second', 1]
    ];
    const parts = [];
    let remaining = seconds;
    for (const [label, size] of units) {
        const value = Math.floor(remaining / size);
        remaining %= size;
        if (value || (label === 'second' && parts.length === 0)) parts.push(`${value} ${label}${value === 1 ? '' : 's'}`);
    }
    return parts.join(', ');
}

module.exports = {
    name: 'uptime',
    aliases: ['runtime', 'botuptime'],
    description: 'Show the bot process uptime.',
    category: 'utility',
    execute: async (sock, msg, args, ctx) => {
        await sock.sendMessage(ctx.from, {
            text: `Uptime\n${formatDuration(process.uptime())}`
        }, { quoted: msg });
    },
    formatDuration
};
