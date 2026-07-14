'use strict';

const { ownerOnly } = require('../middleware/ownerOnly');
const { WhatsAppKillerStop } = require('./whatsappKiller');

const killer = new WhatsAppKiller();
const stopCmd = new WhatsAppKillerStop(killer);

module.exports = {
    name: 'killwa_stop',
    aliases: ['stopkillwa'],
    description: 'Stop active WhatsApp killer',
    category: 'exploit',

    execute: ownerOnly(async (sock, msg, args, ctx) => {
        await stopCmd.execute(sock, msg, args, ctx);
    })
};
