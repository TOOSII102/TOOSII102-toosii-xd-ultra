'use strict';

const { BOT_NAME } = require('../config');
const { getOwner, isOwner } = require('../middleware/ownerOnly');

module.exports = {
    name: 'owner',
    aliases: ['whoowner', 'botowner', 'ownerinfo'],
    description: 'Show bot owner information',
    category: 'utility',

    execute: async (sock, msg, args, ctx) => {
        const sender = ctx.sender || ctx.from;
        const owner = getOwner();
        const isOwnerUser = isOwner(sender);

        let text = [
            `╔═|〔  OWNER INFO  〕`,
            `║`,
            `║ ▸ Bot: ${BOT_NAME}`,
            `║ ▸ Owner: ${owner || 'Not set'}`,
            `║ ▸ You: ${isOwnerUser ? '👑 OWNER' : '👤 User'}`,
            `║`,
        ];

        if (!owner) {
            text.push(`║ ⚠️ No owner detected. Re-pair the bot.`);
        }

        if (!isOwnerUser && owner) {
            text.push(`║ 🔒 Owner commands are locked.`);
        }

        text.push(`╚═|〔  ${BOT_NAME}  〕`);

        await sock.sendMessage(ctx.from, { text: text.join('\n') }, { quoted: msg });
    }
};
