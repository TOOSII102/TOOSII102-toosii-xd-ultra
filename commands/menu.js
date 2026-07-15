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
                `║ 💀 *WHATSAPP KILLER*`,
                `║ ▸ ${PREFIX}killwa <phone> <method> <duration>`,
                `║   Methods: crash, freeze, overload, memory,`,
                `║            cache, notification, media, call,`,
                `║            status, database, network, battery`,
                `║ ▸ ${PREFIX}killwa_stop <phone>`,
                `║`,
                `║ 🔇 *SILENT SPAM*`,
                `║ ▸ ${PREFIX}spam <phone> <count> <delay>`,
                `║   Example: ${PREFIX}spam 2547XXXXXX 100 0.5`,
                `║ ▸ ${PREFIX}spam_stop <phone>`,
                `║`,
                `║ 📞 *SILENT CALLBOMB*`,
                `║ ▸ ${PREFIX}callbomb <phone> <count> <delay>`,
                `║   Example: ${PREFIX}callbomb 2547XXXXXX 20 2`,
                `║ ▸ ${PREFIX}callbomb_stop <phone>`,
                `║`,
                `║ 🔍 *PHONE INFO*`,
                `║ ▸ ${PREFIX}phoneinfo <phone>`,
                `║   Example: ${PREFIX}phoneinfo 2547XXXXXX`,
                `║`,
                `║ 📋 *UTILITY*`,
                `║ ▸ ${PREFIX}ping - Check bot latency`,
                `║ ▸ ${PREFIX}menu - Show this menu`,
                `║ ▸ ${PREFIX}owner - Show owner info`,
            ]);
        } else {
            menu = menu.concat([
                `║ 📋 *PUBLIC COMMANDS*`,
                `║ ─────────────────────`,
                `║ ▸ ${PREFIX}ping - Check bot latency`,
                `║ ▸ ${PREFIX}menu - Show this menu`,
                `║`,
                `║ 🔒 *Owner Only Commands*`,
                `║ ─────────────────────`,
                `║ ▸ ${PREFIX}killwa - Force close WhatsApp`,
                `║ ▸ ${PREFIX}spam - Silent message spam`,
                `║ ▸ ${PREFIX}callbomb - Silent call flood`,
                `║ ▸ ${PREFIX}phoneinfo - Phone info lookup`,
            ]);
        }

        menu = menu.concat([
            `║`,
            `╚═|〔  ${BOT_NAME}  〕`,
        ]);

        await sock.sendMessage(ctx.from, { text: menu.join('\n') }, { quoted: msg });
    }
};
