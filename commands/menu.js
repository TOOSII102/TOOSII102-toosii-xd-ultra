'use strict';

const { BOT_NAME, PREFIX } = require('../config');
const { isOwner } = require('../middleware/ownerOnly');

module.exports = {
    name: 'menu',
    aliases: ['help', 'commands', 'cmds'],
    description: 'Show all available commands',
    category: 'utility',

    execute: async (sock, msg, args, ctx) => {
        const sender = ctx.sender || ctx.from;
        const isOwnerUser = isOwner(sender);

        let menu = [
            `╔═|〔  ${BOT_NAME} MENU  〕`,
            `║`,
            `║ 📋 *PUBLIC COMMANDS*`,
            `║ ─────────────────────`,
            `║ ▸ ${PREFIX}ping - Check bot latency`,
            `║ ▸ ${PREFIX}menu - Show this menu`,
        ];

        if (isOwnerUser) {
            menu = menu.concat([
                `║`,
                `║ 🔒 *OWNER COMMANDS*`,
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
            ]);
        }

        menu = menu.concat([
            `║`,
            `╚═|〔  ${BOT_NAME}  〕`,
        ]);

        await sock.sendMessage(ctx.from, { text: menu.join('\n') }, { quoted: msg });
    }
};
