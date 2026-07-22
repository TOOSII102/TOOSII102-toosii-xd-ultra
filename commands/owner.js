'use strict';

const { BOT_NAME, OWNER_NUMBER } = require('../config');

function getOwnerNumber() {
    return OWNER_NUMBER || 'Not set';
}

function isOwner(sender) {
    const senderNumber = sender.split('@')[0].replace(/[^0-9]/g, '');
    const ownerNumber = OWNER_NUMBER.replace(/[^0-9]/g, '');
    return senderNumber === ownerNumber;
}

module.exports = {
    name: 'owner',
    aliases: ['whoowner', 'botowner', 'ownerinfo'],
    description: 'Show bot owner information',
    category: 'utility',

    execute: async (sock, msg, args, ctx) => {
        const sender = ctx.sender || ctx.from;
        const owner = getOwnerNumber();
        const isOwnerUser = isOwner(sender);

        let lines = [
            `╔═|〔  OWNER INFO  〕`,
            `║`,
            `║ ▸ Bot  : ${BOT_NAME}`,
            `║ ▸ Owner: ${owner}`,
            `║ ▸ You  : ${isOwnerUser ? '👑 OWNER' : '👤 User'}`,
        ];

        if (!owner) {
            lines.push(`║ ⚠️ No owner set in .env.`);
        }
        lines.push(`╚═|〔  ${BOT_NAME}  〕`);

        await sock.sendMessage(ctx.from, { text: lines.join('\n') }, { quoted: msg });
    }
};
