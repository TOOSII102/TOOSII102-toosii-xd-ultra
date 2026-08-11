'use strict';

const { BOT_NAME, OWNER_NUMBER } = require('../config');

function getOwnerNumber() {
    return OWNER_NUMBER.trim();
}

function normalizePhone(value) {
    return String(value || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
}

function isOwner(sender) {
    const senderNumber = normalizePhone(sender);
    const ownerNumber = normalizePhone(OWNER_NUMBER);
    return Boolean(ownerNumber) && senderNumber === ownerNumber;
}

module.exports = {
    name: 'owner',
    aliases: ['whoowner', 'botowner', 'ownerinfo'],
    description: 'Show bot owner information',
    category: 'utility',

    execute: async (sock, msg, args, ctx) => {
        const sender = ctx.sender || ctx.from;
        const owner = getOwnerNumber();
        const ownerDisplay = owner || 'Not set';
        const isOwnerUser = isOwner(sender);

        let lines = [
            `╔═|〔  OWNER INFO  〕`,
            `║`,
            `║ ▸ Bot  : ${BOT_NAME}`,
            `║ ▸ Owner: ${ownerDisplay}`,
            `║ ▸ You  : ${isOwnerUser ? '👑 OWNER' : '👤 User'}`,
        ];

        if (!owner) {
            lines.push(`║ ⚠️ No owner set in .env.`);
        }
        lines.push(`╚═|〔  ${BOT_NAME}  〕`);

        await sock.sendMessage(ctx.from, { text: lines.join('\n') }, { quoted: msg });
    }
};
