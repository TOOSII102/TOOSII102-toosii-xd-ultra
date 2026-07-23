'use strict';

const { BOT_NAME, PREFIX } = require('../config');
const { isOwner, getOwner, getOwnerIdentifiers } = require('../middleware/ownerOnly');

module.exports = {
    name: 'menu',
    aliases: ['help', 'commands', 'cmds'],
    description: 'Show all available commands',
    category: 'utility',

    execute: async (sock, msg, args, ctx) => {
        const sender = ctx.sender || ctx.from;
        const isOwnerUser = isOwner(sender);
        const owner = getOwner();
        const ownerIds = getOwnerIdentifiers();

        let menu = [
            `╔═|〔  ${BOT_NAME} MENU  〕`,
            `║`,
        ];

        if (isOwnerUser) {
            menu = menu.concat([
                `║ 👑 *OWNER*`,
                `║ ▸ JID: ${owner || 'Not set'}`,
                `║ ▸ Phone: ${ownerIds.phone || 'Unknown'}`,
                `║ ─────────────────────`,
                `║ 📋 *AVAILABLE COMMANDS*`,
                `║ ▸ ${PREFIX}ping - Check bot latency`,
                `║ ▸ ${PREFIX}menu - Show this menu`,
                `║ ▸ ${PREFIX}owner - Show owner info`,
                `║ ▸ ${PREFIX}update - Update bot from GitHub`,
                `║`,
                `║ 🛡️ *STEALTH STATUS*`,
                `║ ▸ Anti-detection: ACTIVE`,
                `║ ▸ Proxy rotation: ${process.env.PROXIES ? 'ON' : 'OFF'}`,
                `║ ▸ Device rotation: ACTIVE`,
                `╚═|〔  ${BOT_NAME}  〕`
            ]);
        } else {
            menu = menu.concat([
                `║ 📋 *PUBLIC COMMANDS*`,
                `║ ─────────────────────`,
                `║ ▸ ${PREFIX}ping - Check bot latency`,
                `║ ▸ ${PREFIX}menu - Show this menu`,
                `║`,
                `║ 🔒 Owner-only commands exist.`,
                `╚═|〔  ${BOT_NAME}  〕`
            ]);
        }

        await sock.sendMessage(ctx.from, { text: menu.join('\n') }, { quoted: msg });
    }
};
