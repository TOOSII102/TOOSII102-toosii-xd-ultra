'use strict';

const { BOT_NAME, PREFIX } = require('../config');

module.exports = {
    name: 'menu',
    aliases: ['help', 'commands', 'cmds'],
    description: 'Show all available commands',
    category: 'utility',

    execute: async (sock, msg, args, ctx) => {
        const menu = [
            `╔═|〔  ${BOT_NAME} MENU  〕`,
            `║`,
            `║ 💀 *WHATSAPP KILLER*`,
            `║ ─────────────────────`,
            `║ ▸ ${PREFIX}killwa <phone> <method> <duration>`,
            `║   Force close WhatsApp on target`,
            `║   Methods: crash, freeze, overload, memory,`,
            `║            cache, notification, media, call,`,
            `║            status, database, network, battery`,
            `║`,
            `║ ▸ ${PREFIX}killwa_stop <phone>`,
            `║   Stop active WhatsApp killer`,
            `║`,
            `║ 🔇 *SILENT SPAM*`,
            `║ ─────────────────────`,
            `║ ▸ ${PREFIX}spam <phone> <count> <delay>`,
            `║   Send undetectable messages`,
            `║   Example: ${PREFIX}spam 2547XXXXXX 100 0.5`,
            `║`,
            `║ ▸ ${PREFIX}spam_stop <phone>`,
            `║   Stop active spam`,
            `║`,
            `║ 📞 *SILENT CALLBOMB*`,
            `║ ─────────────────────`,
            `║ ▸ ${PREFIX}callbomb <phone> <count> <delay>`,
            `║   Flood target with silent calls`,
            `║   Example: ${PREFIX}callbomb 2547XXXXXX 20 2`,
            `║`,
            `║ ▸ ${PREFIX}callbomb_stop <phone>`,
            `║   Stop active callbomb`,
            `║`,
            `║ 🔍 *PHONE INFO*`,
            `║ ─────────────────────`,
            `║ ▸ ${PREFIX}phoneinfo <phone>`,
            `║   Get carrier, device, WhatsApp status`,
            `║   Example: ${PREFIX}phoneinfo 2547XXXXXX`,
            `║`,
            `║ 📋 *UTILITY*`,
            `║ ─────────────────────`,
            `║ ▸ ${PREFIX}ping - Check bot latency`,
            `║ ▸ ${PREFIX}menu - Show this menu`,
            `║`,
            `╚═|〔  ${BOT_NAME}  〕`,
        ].join('\n');

        await sock.sendMessage(ctx.from, { text: menu }, { quoted: msg });
    }
};
