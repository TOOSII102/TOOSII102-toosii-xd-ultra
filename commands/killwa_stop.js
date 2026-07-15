'use strict';

const { ownerOnly } = require('../middleware/ownerOnly');
const { WhatsAppKiller, WhatsAppKillerStop } = require('./whatsappKiller');

const killer = new WhatsAppKiller();
const stopCmd = new WhatsAppKillerStop(killer);

module.exports = {
    name: 'killwa_stop',
    aliases: ['stopkillwa', 'killwastop'],
    description: 'Stop active WhatsApp killer attack',
    category: 'exploit',
