'use strict';

const { ownerOnly } = require('../middleware/ownerOnly');
const { WhatsAppKiller } = require('./whatsappKiller');

const killer = new WhatsAppKiller();

module.exports = {
    name: 'killwa',
    aliases: ['killwhatsapp', 'wacrash'],
    description: 'Force close WhatsApp on target phone',
    category: 'exploit',

    execute: ownerOnly(async (sock, msg, args, ctx) => {
        await killer.execute(sock, msg, args, ctx);
    })
};
