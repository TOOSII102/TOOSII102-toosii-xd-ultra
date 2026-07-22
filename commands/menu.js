'use strict';

const { BOT_NAME, PREFIX, OWNER_NUMBER } = require('../config');

function isOwner(sender) {
    const senderNumber = sender.split('@')[0].replace(/[^0-9]/g, '');
    const ownerNumber = OWNER_NUMBER.replace(/[^0-9]/g, '');
    return senderNumber === ownerNumber;
}

module.exports = {
    name: 'menu',
    aliases: ['help', 'commands', 'cmds'],
    description: 'Show all available commands',
    category: 'utility',

    execute: async (sock, msg, args, ctx) => {
        const sender = ctx.sender || ctx.from;
        const isOwnerUser = isOwner(sender);

        let lines = [
            `╔═|〔  ${BOT_NAME} MENU  〕`,
            `║`,
            `║ 📋 *AVAILABLE COMMANDS*`,
            `║ ─────────────────────`,
            `║ ▸ ${PREFIX}ping - Check bot latency`,
            `║ ▸ ${PREFIX}menu - Show this menu`,
            `║ ▸ ${PREFIX}owner - Show bot owner info`,
        ];

        if (isOwnerUser) {
            lines.push(`║`);
            lines.push(`║ 🔒 *Owner-only commands (disabled)*`);
            lines.push(`║   No attack commands are currently loaded.`);
        } else {
            lines.push(`║`);
            lines.push(`║ 🔒 *Owner commands locked*`);
        }

        lines.push(`╚═|〔  ${BOT_NAME}  〕`);

        await sock.sendMessage(ctx.from, { text: lines.join('\n') }, { quoted: msg });
    }
};
