'use strict';

const { BOT_NAME } = require('../config');
const { getOwnerIdentifiers, isOwner } = require('../middleware/ownerOnly');

module.exports = {
    name: 'owner',
    aliases: ['whoowner', 'botowner', 'ownerinfo'],
    description: 'Show bot owner information.',
    category: 'utility',
    execute: async (sock, msg, args, ctx) => {
        const { phone: ownerPhone } = getOwnerIdentifiers();
        const owner = ownerPhone || 'Not linked';
        const ownerUser = isOwner(ctx.sender || ctx.from);
        const lines = [
            '╔═|〔  OWNER INFO  〕',
            '║',
            `║ ▸ Bot  : ${BOT_NAME}`,
            `║ ▸ Owner: ${owner}`,
            `║ ▸ You  : ${ownerUser ? 'OWNER' : 'User'}`
        ];

        if (!ownerPhone) lines.push('║ ▸ Link a WhatsApp account to enable owner-only commands.');
        lines.push(`╚═|〔 ${BOT_NAME}  〕`);
        await sock.sendMessage(ctx.from, { text: lines.join('\n') }, { quoted: msg });
    }
};
